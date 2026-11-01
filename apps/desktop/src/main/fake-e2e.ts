// Entra em cena com SABRE_E2E=1 (teste) e no modo demonstração "Explorar sem grupo" (appmel-1.31), que usa só as peças.
// Cartório falso com estado + servidor Minecraft de mentira: nenhuma porta abre, nenhum mundo é tocado.
import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { criarPacote } from "@sabrehosting/nucleo/backup/pacote";
import { nomeDoBackup } from "@sabrehosting/nucleo/backup/agendador";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import type { ModGrupo, RespostaTrava } from "@sabrehosting/nucleo/cartorio/tipos";
import { depsBackups } from "./deps-backups.js";
import type { DepsBackups } from "./backups.js";
import type { DepsBoasVindas } from "./boas-vindas.js";
import type { DepsGrupo } from "./grupo.js";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";
import type { DepsImportacao } from "./importar.js";
import type { DepsVersao } from "./versao.js";
import type { DepsModsGrupo } from "./mods-grupo.js";
import { erroSemGrupo, type DepsInicio } from "./inicio.js";

// "dono-eu*": app reaberto com a trava ainda em nome deste PC, sem servidor desta sessão (com ou sem órfão vivo).
export type Cenario = "ninguem" | "outro" | "eu" | "sem-cartorio" | "dono-eu" | "dono-eu-orfao";
const NEO = "21.1.172";
const MEU_ID = 1;
const ENDERECO = "mundo.exemplo.net";

export interface Espiao {
  spawns: { cmd: string; args: readonly string[]; cwd: unknown }[];
}

/** Processo filho de mentira: diz "Done (" ao subir e sai ao receber "stop". */
function filhoFalso(registrar: (e: string) => void): ChildProcess {
  const f = new EventEmitter() as EventEmitter & Record<string, unknown>;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  stdin.on("data", (d: Buffer) => {
    if (String(d).includes("stop")) {
      registrar("parou");
      setTimeout(() => f.emit("close", 0), 10);
    }
  });
  f["stdin"] = stdin;
  f["stdout"] = stdout;
  f["stderr"] = new PassThrough();
  f["pid"] = 1;
  f["kill"] = () => f.emit("close", null);
  setTimeout(
    () =>
      stdout.write(
        '[12:00:00] [Server thread/INFO] [minecraft/DedicatedServer]: Done (0.1s)! For help, type "help"\n',
      ),
    300,
  );
  return f as unknown as ChildProcess;
}

export function criarDepsE2E(cenario: Cenario, espiao: Espiao): DepsInicio {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-e2e-servidor-"));
  writeFileSync(join(pasta, "eula.txt"), "eula=true\n");
  const dirArgs = join(pasta, "libraries/net/neoforged/neoforge", NEO);
  mkdirSync(dirArgs, { recursive: true });
  for (const a of ["unix_args.txt", "win_args.txt"]) writeFileSync(join(dirArgs, a), "# args\n");

  // Ordem dos fatos, para o E2E provar "parou → soltou a trava → só então saiu".
  const registrar = (evento: string): void => {
    const arquivo = process.env["SABRE_E2E_REGISTRO"];
    if (arquivo) appendFileSync(arquivo, `${evento}\n`);
  };
  let dono: { id: number; nome: string } | null =
    cenario === "outro"
      ? { id: 2, nome: "Lucas" }
      : cenario.startsWith("dono-eu")
        ? { id: MEU_ID, nome: "Este PC" }
        : null;
  let epoca = 1;
  const aceita = (): RespostaTrava => ({
    ok: true,
    epoca,
    expiraEm: Date.now() + 60_000,
    renovarMs: 20_000,
  });
  const recusa = (): RespostaTrava => ({
    ok: false,
    erro: "ocupada",
    motivo: "ocupada",
    donoPcId: dono?.id ?? null,
    epoca,
    expiraEm: Date.now() + 60_000,
  });
  const cliente = {
    estadoTrava: async () => {
      if (cenario === "sem-cartorio") throw erroSemGrupo();
      return { dono, epoca, expiraEm: Date.now() + 60_000, prazoMs: 60_000, renovarMs: 20_000 };
    },
    pegar: async () => {
      if (dono && dono.id !== MEU_ID) return recusa(); // como o cartório: o próprio dono pega de novo
      dono = { id: MEU_ID, nome: "Este PC" };
      return aceita();
    },
    renovar: async () => (dono?.id === MEU_ID ? aceita() : recusa()),
    soltar: async () => {
      registrar("soltar");
      if (dono?.id === MEU_ID) dono = null;
      epoca++;
      return aceita();
    },
  };

  const copias: string[] = [];
  (globalThis as Record<string, unknown>)["__sabreE2EInicio"] = {
    copias,
    dono: () => dono,
    cliente,
  };
  return {
    lerTrava: cliente.estadoTrava,
    hospedar: async (aoPerder) => {
      await new Promise((ok) => setTimeout(ok, 400)); // dá tempo de o E2E ver o progresso
      return hospedar({
        cliente,
        aoPerder,
        pasta,
        javaPath: "java-falso",
        versaoNeoForge: NEO,
        plataforma: "linux",
        spawnFn: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => {
          espiao.spawns.push({ cmd, args, cwd: opcoes.cwd });
          return filhoFalso(registrar);
        },
      });
    },
    eu: async () => ({ id: MEU_ID }),
    // Painel do Início: dados de mentira (SABRE_E2E_SEM_DADOS=1 tira todos, como no app sem grupo).
    ...(process.env["SABRE_E2E_SEM_DADOS"] === "1"
      ? {}
      : {
          ultimoBackup: async () => new Date(Date.now() - 3 * 3_600_000).toISOString(),
          versaoMundo: async () => 12,
          jogadores: async () =>
            (process.env["SABRE_E2E_JOGADORES"] ?? "Ana,Lucas").split(",").filter((n) => n !== ""),
        }),
    servidorOrfao: async () => cenario === "dono-eu-orfao",
    endereco: process.env["SABRE_E2E_SEM_ENDERECO"] === "1" ? "" : ENDERECO,
    copiar: (t) => void copias.push(t),
  };
}

/**
 * Backups do E2E: mundo e backup inventados em pasta temporária, com o `restaurarBackup` DE VERDADE e o cartório
 * falso do cenário (a trava é pega e devolvida pelo caminho normal). `level.dat` guarda qual versão é o mundo.
 */
export function depsBackupsE2E(servidorRodando: () => boolean): DepsBackups {
  const raiz = mkdtempSync(join(tmpdir(), "sabre-e2e-backups-"));
  const mundo = join(raiz, "world");
  const backups = join(raiz, "backups");
  mkdirSync(mundo, { recursive: true });
  mkdirSync(backups, { recursive: true });
  writeFileSync(join(mundo, "level.dat"), "do-backup");
  const nome = nomeDoBackup(new Date("2026-10-30T14:05:09.000Z"), 7);
  const pronto = criarPacote(mundo, join(backups, nome), { versao: 7, epoca: 1 }).then(() =>
    writeFileSync(join(mundo, "level.dat"), "atual"),
  );
  const compartilhado = (globalThis as Record<string, unknown>)["__sabreE2EInicio"] as {
    cliente: Parameters<typeof depsBackups>[0]["cliente"];
  };
  (globalThis as Record<string, unknown>)["__sabreE2EBackups"] = { mundo, backups, nome };
  const real = depsBackups({
    pastaBackups: backups,
    pastaDoMundo: mundo,
    cliente: {
      ...compartilhado.cliente,
      estadoTrava: async () => ({ epoca: 1 }),
    },
    servidorRodando,
  });
  return {
    ...real,
    listar: async () => (await pronto, real.listar()),
    restaurar: async (n) => (await pronto, real.restaurar(n)),
  };
}

/**
 * Grupo do E2E: cartório falso com 3 PCs (o dono, Lucas e Ana). `SABRE_E2E_DONO=1` faz este PC ser o dono;
 * sem isso ele é um PC comum. Os ids tirados ficam em `__sabreE2EGrupo.revogados` para o teste conferir.
 */
export function depsGrupoE2E(dono?: boolean): DepsGrupo {
  const souDono = dono ?? process.env["SABRE_E2E_DONO"] === "1";
  let pcs = [
    { id: 1, nome: "PC do Eliel", dono: true },
    { id: 2, nome: "PC do Lucas", dono: false },
    { id: 3, nome: "PC da Ana", dono: false },
  ];
  const revogados: number[] = [];
  // Só nome e horas: o texto do convite nunca é guardado, nem no cartório falso.
  const convites: Array<{ nomePc: string; horas: number }> = [];
  (globalThis as Record<string, unknown>)["__sabreE2EGrupo"] = { revogados, convites };
  return {
    eu: async () => ({ id: souDono ? 1 : 2, dono: souDono }),
    listarPcs: async () => pcs,
    lerEndereco: async () => ENDERECO,
    criarConvite: async (nomePc, horas) => {
      convites.push({ nomePc, horas });
      return {
        convite: `sabre://convite/1.FALSO-${nomePc}`,
        expiraEm: Date.now() + horas * 3_600_000,
      };
    },
    revogarPc: async (id) => {
      revogados.push(id);
      pcs = pcs.filter((p) => p.id !== id);
    },
  };
}

/**
 * Importar do E2E: o seletor "escolhe" um zip inventado e o cartório é falso. `SABRE_E2E_VERSAO_GRUPO=<n>` faz o
 * grupo já ter mundo; `SABRE_E2E_DONO=1` faz este PC ser o dono. As importações ficam em
 * `__sabreE2EImportar.chamadas` (zip e se aceitou virar a versão nova) para o teste conferir.
 */
export function depsImportacaoE2E(
  servidorRodando: () => boolean,
  restaurando: () => boolean,
  dono?: boolean,
): DepsImportacao {
  const versaoNoGrupo = Number(process.env["SABRE_E2E_VERSAO_GRUPO"] ?? "") || null;
  const chamadas: Array<{ zip: string; aceitar: boolean }> = [];
  (globalThis as Record<string, unknown>)["__sabreE2EImportar"] = { chamadas };
  return {
    escolherArquivo: async () => join(tmpdir(), "mundo-da-hospedagem.zip"),
    analisar: async () => ({
      arquivos: 1234,
      versaoMinecraft: process.env["SABRE_E2E_VERSAO_MC"] ?? "1.21.1",
      indicios: { plugins: true, mods: false },
    }),
    situacao: async () => ({
      versaoNoGrupo,
      dono: dono ?? process.env["SABRE_E2E_DONO"] === "1",
    }),
    importar: async (zip, aceitar) => {
      chamadas.push({ zip, aceitar });
      await new Promise((ok) => setTimeout(ok, 300)); // dá tempo de a tela mostrar o progresso
      return { versao: (versaoNoGrupo ?? 0) + 1 };
    },
    servidorRodando,
    restaurando,
  };
}

/** Versão do grupo falsa para o E2E: só o dono (SABRE_E2E_DONO=1) vê a área; gravações ficam em `__sabreE2EVersao`. */
export function depsVersaoE2E(servidorRodando: () => boolean, dono?: boolean): DepsVersao {
  const souDono = dono ?? process.env["SABRE_E2E_DONO"] === "1";
  let atual = "1.21.1";
  const gravados: string[] = [];
  (globalThis as Record<string, unknown>)["__sabreE2EVersao"] = { gravados };
  return {
    eu: async () => ({ id: souDono ? 1 : 2, dono: souDono }),
    lerAtual: async () => atual,
    listar: async () => ["1.21.1", "1.20.4", "1.12.2"],
    opcoes: async (v) => ({
      neoforge: v !== "1.12.2",
      fabricForge: v === "1.21.1",
      consultou: true,
    }),
    sha1Do: async () => "b".repeat(40),
    backupAntes: async () => undefined,
    gravar: async (v) => void (gravados.push(v), (atual = v)),
    servidorRodando,
  };
}

const PASTA_INSTANCIA_FALSA = "/sabre-e2e/instancia/mods";

/** Mods do grupo falsos para o E2E: dono com `SABRE_E2E_DONO=1`; as gravações ficam em `__sabreE2EMods.listas`. */
export function depsModsE2E(servidorRodando: () => boolean, dono?: boolean): DepsModsGrupo {
  const souDono = dono ?? process.env["SABRE_E2E_DONO"] === "1";
  let lista: ModGrupo[] = [
    {
      nome: "Sodium",
      versao: "0.6.0",
      arquivo: "sodium.jar",
      url: "https://cdn.modrinth.com/data/AANobbMI/versions/x/sodium.jar",
      sha512: "a".repeat(128),
      lado: "cliente",
    },
  ];
  const listas: ModGrupo[][] = [];
  // Interruptores do teste: `semInstancia` deixa a pasta da instância do Prism inexistente; `falhaLer` faz a leitura falhar.
  // `leiturasOk`: quantas leituras passam antes de `falhaLer` começar a valer (a ação lê a lista antes de conferir).
  const interruptores = { listas, semInstancia: false, falhaLer: false, leiturasOk: 0 };
  (globalThis as Record<string, unknown>)["__sabreE2EMods"] = interruptores;
  return {
    eu: async () => ({ id: souDono ? 1 : 2, dono: souDono }),
    lerLista: async () => {
      if (interruptores.falhaLer) {
        if (interruptores.leiturasOk > 0) interruptores.leiturasOk -= 1;
        else throw new Error("cartório não respondeu");
      }
      return lista;
    },
    gravarLista: async (nova) => void (listas.push(nova), (lista = nova)),
    pastaDoServidor: () => undefined,
    pastaDaInstancia: () => (interruptores.semInstancia ? undefined : PASTA_INSTANCIA_FALSA),
    servidorRodando,
    sincronizar: async () => ({ baixados: [], mantidos: [], removidos: [], falhas: [] }),
  };
}

const ACESSO_FALSO = "token-falso-do-e2e";

/**
 * Assistente de primeira vez do E2E: cartório e WireGuard falsos. Sem `SABRE_E2E_BOAS_VINDAS=1` o PC já nasce
 * configurado (as outras telas não veem o assistente). `SABRE_E2E_SEM_COFRE=1` tira o cofre do sistema.
 * `SABRE_E2E_COFRE_CORROMPIDO=1` faz o PC já configurado com um token guardado que não decifra. O convite com
 * código `usado` é recusado como o cartório recusaria; o de código `cai-uma-vez` gasta o convite e falha na conexão
 * só na primeira vez (o "Tentar de novo" entra). Tudo que o "passo elevado" recebeu fica em
 * `__sabreE2EBoasVindas` (chamadas, token guardado) para o teste conferir.
 */
export function depsBoasVindasE2E(dados: string): {
  deps: DepsBoasVindas;
  escolherPasta: () => Promise<string | undefined>;
} {
  const ligado = process.env["SABRE_E2E_BOAS_VINDAS"] === "1";
  const corrompido = process.env["SABRE_E2E_COFRE_CORROMPIDO"] === "1";
  if (!ligado || corrompido) {
    mkdirSync(dados, { recursive: true });
    writeFileSync(
      join(dados, "boas-vindas.json"),
      JSON.stringify({ grupo: { nome: "Grupo" }, concluido: true, pastaBase: join(dados, "base") }),
    );
  }
  const registro = { entradas: [] as string[], tokens: [] as string[] };
  (globalThis as Record<string, unknown>)["__sabreE2EBoasVindas"] = registro;
  return {
    deps: {
      dados,
      agora: Date.now,
      gerarChaves: gerarChavesDoPc,
      cofreDisponivel: () => process.env["SABRE_E2E_SEM_COFRE"] !== "1",
      cofre: {
        guardar: async (t) => void registro.tokens.push(t),
        ler: async () => registro.tokens[0],
        // `SABRE_E2E_COFRE_CORROMPIDO=1`: o token guardado existe e não decifra.
        estado: async () => ({ tipo: corrompido ? "corrompido" : "ok" }),
      },
      entrar: async (convite) => {
        registro.entradas.push(convite.grupo);
        if (convite.codigo === "usado")
          throw Object.assign(new Error("O convite foi recusado."), { tipo: "acesso" });
        if (convite.codigo === "cai-uma-vez" && registro.entradas.length === 1)
          throw Object.assign(new Error("A conexão não terminou. Clique em “Tentar de novo”."), {
            conviteGasto: true,
          });
        return { token: ACESSO_FALSO };
      },
      lerGrupo: async () => ({ nome: "Amigos do E2E", endereco_jogar: "jogar.exemplo.org:25565" }),
      pastaPadrao: () => join(dados, "padrao"),
    },
    escolherPasta: async () => join(dados, "escolhida"),
  };
}
