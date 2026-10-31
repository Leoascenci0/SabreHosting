import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type Server, type Socket, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criarAjudanteSocket, gerarParProvisorio, pedirAoSocket } from "./ajudante.js";
import { CAMINHO_HUB_ENV, grupoDoAmbiente } from "./ambiente.js";

const WRAPPER = resolve(import.meta.dirname, "../../../infra/vps/wg/ajudante-socket.sh");
const pastas: string[] = [];
const servidores: Server[] = [];
afterEach(() => {
  for (const s of servidores.splice(0)) s.close();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

function pasta() {
  const p = mkdtempSync(join(tmpdir(), "sabre-sock-"));
  pastas.push(p);
  return p;
}

/** Socket unix de teste: `atender` recebe cada conexão (como o systemd com Accept=yes). */
async function socket(atender: (c: Socket) => void) {
  const caminho = join(pasta(), "ajudante.sock");
  // Meia-conexão como no socket do systemd: o cliente fecha a ida e ainda recebe a resposta.
  const s = createServer({ allowHalfOpen: true }, atender);
  servidores.push(s);
  await new Promise<void>((ok) => s.listen(caminho, ok));
  return caminho;
}

/** Responde `resposta` a cada pedido e guarda as linhas recebidas. */
async function socketQueResponde(resposta: string) {
  const pedidos: string[] = [];
  const caminho = await socket((c) => {
    let buf = "";
    c.setEncoding("utf8");
    c.on("data", (d: string) => {
      buf += d;
      if (buf.includes("\n")) {
        pedidos.push(buf);
        c.end(`${resposta}\n`);
      }
    });
  });
  return { ajudante: criarAjudanteSocket(caminho), pedidos };
}

const CHAVE = gerarParProvisorio().publica;

describe("ajudante pelo socket (rede-1.5)", () => {
  it("manda uma linha JSON {comando, args} por conexão e lê uma de volta", async () => {
    const a = await socketQueResponde('{"ip":"10.66.0.201"}');
    expect(await a.ajudante.adicionar(CHAVE)).toBe("10.66.0.201");
    const pacote = {
      ip_pc: "10.66.0.12",
      chave_publica_hub: CHAVE,
      endpoint: "hub.exemplo:51820",
      allowed_ips: "10.66.0.0/24",
    };
    const t = await socketQueResponde(JSON.stringify(pacote));
    expect(await t.ajudante.trocar("10.66.0.201", "pc-da-ana", CHAVE)).toEqual(pacote);
    const r = await socketQueResponde('{"ok":true}');
    await r.ajudante.remover("10.66.0.201");
    expect([...a.pedidos, ...t.pedidos, ...r.pedidos]).toEqual([
      `{"comando":"entrada-adicionar","args":["${CHAVE}"]}\n`,
      `{"comando":"entrada-trocar","args":["10.66.0.201","pc-da-ana","${CHAVE}"]}\n`,
      '{"comando":"entrada-remover","args":["10.66.0.201"]}\n',
    ]);
  });

  it("recusa do ajudante (codigo 1 ou 2) vira erro, também no remover", async () => {
    const um = await socketQueResponde('{"codigo":1,"erro":"ERRO: a sala de entrada está cheia"}');
    await expect(um.ajudante.adicionar(CHAVE)).rejects.toThrow(
      /recusou.*sala de entrada está cheia/,
    );
    const dois = await socketQueResponde('{"codigo":2,"erro":"pedido recusado"}');
    await expect(dois.ajudante.remover("10.66.0.201")).rejects.toThrow(/pedido recusado/);
  });

  it("saída torta do ajudante é recusada (IP fora da faixa, pacote inválido, JSON ilegível)", async () => {
    await expect(
      (await socketQueResponde('{"ip":"10.66.0.12"}')).ajudante.adicionar(CHAVE),
    ).rejects.toThrow(/sala de entrada/);
    await expect((await socketQueResponde("ERRO")).ajudante.adicionar(CHAVE)).rejects.toThrow(
      /ilegível/,
    );
    for (const torto of [
      {
        ip_pc: "10.66.0.201",
        chave_publica_hub: CHAVE,
        endpoint: "h:1",
        allowed_ips: "10.66.0.0/24",
      },
      { ip_pc: "10.66.0.5", chave_publica_hub: "x", endpoint: "h:1", allowed_ips: "10.66.0.0/24" },
      { ip_pc: "10.66.0.5", chave_publica_hub: CHAVE, endpoint: "h:1", allowed_ips: "0.0.0.0/0 " },
    ]) {
      const t = await socketQueResponde(JSON.stringify(torto));
      await expect(t.ajudante.trocar("10.66.0.201", "pc", CHAVE)).rejects.toThrow(/inválido/);
    }
  });

  it("socket recusado, fechado sem resposta, mudo além do prazo ou resposta enorme → erro", async () => {
    await expect(
      criarAjudanteSocket(join(pasta(), "nao-existe.sock")).adicionar(CHAVE),
    ).rejects.toThrow(/ENOENT/);
    const fecha = await socket((c) => c.end());
    await expect(criarAjudanteSocket(fecha).adicionar(CHAVE)).rejects.toThrow(
      /fechou sem responder/,
    );
    const mudo = await socket(() => undefined);
    await expect(pedirAoSocket(mudo, "entrada-remover", ["10.66.0.201"], 50)).rejects.toThrow(
      /não respondeu a tempo/,
    );
    const enorme = await socket((c) => c.write("x".repeat(5000)));
    await expect(criarAjudanteSocket(enorme).adicionar(CHAVE)).rejects.toThrow(/ilegível/);
  });

  it("resposta passa de 4096 bytes antes do \\n → erro, mesmo com o \\n no mesmo pedaço ou em vários pedaços", async () => {
    // JSON válido, só que enorme: sem o teto no total, seria aceito.
    const valido = `{"ip":"10.66.0.201"${" ".repeat(5000)}}`;
    const umPedaco = await socket((c) => c.end(`${valido}\n`));
    await expect(criarAjudanteSocket(umPedaco).adicionar(CHAVE)).rejects.toThrow(/ilegível/);
    const doisPedacos = await socket((c) => {
      c.write(valido.slice(0, 3000));
      setTimeout(() => c.end(`${valido.slice(3000)}\n`), 20);
    });
    await expect(criarAjudanteSocket(doisPedacos).adicionar(CHAVE)).rejects.toThrow(/ilegível/);
    // No limite (4096 bytes antes do \n) ainda vale; o teto conta bytes, não letras.
    const noLimite = `{"ip":"10.66.0.201"${" ".repeat(4096 - 20)}}`;
    expect(Buffer.byteLength(noLimite)).toBe(4096);
    const ok = await socket((c) => c.end(`${noLimite}\n`));
    expect(await criarAjudanteSocket(ok).adicionar(CHAVE)).toBe("10.66.0.201");
    const acentos = await socket((c) => c.end(`{"ip":"10.66.0.201","x":"${"é".repeat(2100)}"}\n`));
    await expect(criarAjudanteSocket(acentos).adicionar(CHAVE)).rejects.toThrow(/ilegível/);
  });

  it("ponta a ponta: cliente → ajudante-socket.sh → ajudante-entrada.sh (simulado)", async () => {
    const estado = pasta();
    const hub = Buffer.alloc(32, 7).toString("base64");
    // Como o systemd com Accept=yes: cada conexão vira o stdin/stdout de um wrapper novo.
    const caminho = await socket((c) => {
      const filho = spawn("bash", [WRAPPER], {
        env: {
          PATH: process.env["PATH"],
          SABRE_SIMULAR: "1",
          SABRE_ESTADO: estado,
          SABRE_ENDPOINT_HUB: "hub.exemplo:51820",
          SABRE_CHAVE_PUB_HUB: hub,
        },
      });
      c.pipe(filho.stdin);
      filho.stdout.pipe(c);
    });
    const ajudante = criarAjudanteSocket(caminho);
    const ip = await ajudante.adicionar(CHAVE);
    expect(ip).toBe("10.66.0.200");
    const definitiva = gerarParProvisorio().publica;
    expect(await ajudante.trocar(ip, "pc-da-ana", definitiva)).toEqual({
      ip_pc: "10.66.0.2",
      chave_publica_hub: hub,
      endpoint: "hub.exemplo:51820",
      allowed_ips: "10.66.0.0/24",
    });
    await ajudante.remover(ip);
    expect(readFileSync(join(estado, "pcs.tsv"), "utf8")).toBe(
      `pc-da-ana\t10.66.0.2\t${definitiva}\tativo\n`,
    );
    await expect(ajudante.trocar("10.66.0.201", "pc-x", definitiva)).rejects.toThrow(
      /recusou.*convite em andamento/,
    );
  });
});

describe("endereço do hub numa fonte só (/etc/sabre/hub.env)", () => {
  const env = {
    SABRE_GRUPO_NOME: "G",
    SABRE_GRUPO_ENDERECO_JOGAR: "jogar.exemplo",
    SABRE_HUB_CHAVE_PUB: CHAVE,
    SABRE_HUB_ENDPOINT: "reserva.exemplo:51820",
  };

  it("o padrão é o arquivo que o instalar.sh grava e o ajudante lê", () => {
    expect(CAMINHO_HUB_ENV).toBe("/etc/sabre/hub.env");
  });

  it("com hub.env, vale o arquivo (a variável solta é ignorada); torto = sem grupo", () => {
    const arq = join(pasta(), "hub.env");
    writeFileSync(arq, "# gravado pelo instalar.sh\nSABRE_ENDPOINT_HUB=hub.exemplo.org:51820\n");
    expect(grupoDoAmbiente(env, arq)?.hubEndpoint).toBe("hub.exemplo.org:51820");
    writeFileSync(arq, "SABRE_ENDPOINT_HUB=x;rm -rf /:1\n");
    expect(grupoDoAmbiente(env, arq)).toBeUndefined();
    writeFileSync(arq, "");
    expect(grupoDoAmbiente(env, arq)).toBeUndefined();
  });

  it("sem hub.env (teste, máquina sem instalador), vale SABRE_HUB_ENDPOINT", () => {
    const ausente = join(pasta(), "nao-existe.env");
    expect(existsSync(ausente)).toBe(false);
    expect(grupoDoAmbiente(env, ausente)?.hubEndpoint).toBe("reserva.exemplo:51820");
  });
});
