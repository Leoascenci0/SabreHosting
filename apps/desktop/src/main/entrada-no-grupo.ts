import { access, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import type { Convite } from "@sabrehosting/nucleo/rede/convite";
import {
  criarExecutorElevado,
  eDoMontador,
  IP_DO_HUB,
  montarConfigDoPc,
  NOME_DO_TUNEL,
  protegerPastaDaRede,
  WIREGUARD_EXE,
  type ParDeChaves,
} from "@sabrehosting/nucleo/rede/wireguard";
import type { ExecArquivo } from "@sabrehosting/nucleo/launcher/prism";

const REDE = "10.66.0.0/24";

export interface OpcoesEntrada {
  /** Pasta protegida do app para o .conf temporário e os sinais entre o app e o passo elevado. */
  pastaRede: string;
  /** Roda o passo elevado (UM só pedido de administrador). Padrão: `criarExecutorElevado` com prazo longo. */
  execElevado?: ExecArquivo;
  /** Só para teste. */
  exec?: ExecArquivo;
  plataforma?: string;
  usuario?: string;
  /** Intervalo e prazo da espera pelo sinal do passo elevado (inclui o tempo de o amigo aceitar o UAC). */
  passoMs?: number;
  prazoMs?: number;
  /** Só para teste: troca o `fetch` do cliente do cartório. */
  fetchFn?: typeof fetch;
}

/** Falha DEPOIS de o convite ser gasto: ele não serve mais; a mensagem manda pedir outro. */
export class ErroDepoisDoConvite extends Error {
  readonly conviteGasto = true;
  constructor(mensagem: string, causa: unknown) {
    super(mensagem, { cause: causa });
    this.name = "ErroDepoisDoConvite";
  }
}

const FALHA_TROCA =
  "Entrei no grupo, mas não consegui terminar a conexão privada deste PC. Esse convite já foi usado: peça um convite novo para quem administra o grupo e tente de novo.";

const PRAZO_ELEVADO_MS = 5 * 60_000;
const ESPERA_SCRIPT_S = 150;
const SINAL = { pronta: "instalada.flag", troca: "troca.go", cancelar: "cancelar.flag" } as const;
const FALHA_INSTALAR =
  "Não consegui instalar a rede privada. Ela precisa da permissão de administrador do Windows e do WireGuard instalado.";

/**
 * Texto FIXO do passo elevado; os caminhos chegam num JSON em base64 (nunca colados no texto, então nenhum caminho
 * pode virar comando). Instala a provisória, sinaliza, espera o app usar o convite e então troca pela definitiva
 * (ou desinstala, se o app cancelar): tudo na MESMA janela de administrador.
 */
export function scriptElevado(dados: { pasta: string; espera: number }): string {
  const json = Buffer.from(
    JSON.stringify({ ...dados, wg: WIREGUARD_EXE, nome: NOME_DO_TUNEL, ...SINAL }),
    "utf8",
  ).toString("base64");
  return [
    `$c = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${json}')) | ConvertFrom-Json`,
    "$conf = Join-Path $c.pasta ($c.nome + '.conf')",
    "$pronta = Join-Path $c.pasta $c.pronta; $troca = Join-Path $c.pasta $c.troca; $cancelar = Join-Path $c.pasta $c.cancelar",
    "try {",
    "  & $c.wg /installtunnelservice $conf; if ($LASTEXITCODE -ne 0) { exit 1 }",
    "  Remove-Item $conf -Force",
    "  New-Item $pronta -ItemType File -Force | Out-Null",
    "  $fim = (Get-Date).AddSeconds($c.espera)",
    "  while ((Get-Date) -lt $fim -and -not (Test-Path $troca) -and -not (Test-Path $cancelar)) { Start-Sleep -Milliseconds 300 }",
    "  & $c.wg /uninstalltunnelservice $c.nome",
    "  if (-not (Test-Path $troca)) { exit 2 }",
    "  & $c.wg /installtunnelservice $conf; if ($LASTEXITCODE -ne 0) { exit 1 }",
    "} finally { Remove-Item $conf -Force -ErrorAction SilentlyContinue }",
  ].join("\n");
}

const existe = (a: string): Promise<boolean> =>
  access(a).then(
    () => true,
    () => false,
  );

/**
 * Passo elevado da entrada no grupo (spec §5.2, item 3), em UM pedido de administrador (appmel-1.13): o executor
 * elevado roda uma vez o `scriptElevado`; o app combina com ele por sinais na pasta protegida da rede.
 * - Cartório recusou (usado, vencido, fora do ar): o app pede o cancelamento, a provisória é desinstalada e a chave
 *   própria nunca é gravada nem instalada; o erro que sobe é o do cartório.
 * - O token vai para o cofre (`guardarToken`) assim que o cartório responde, ANTES de gravar a definitiva: se a troca
 *   falhar, o token não se perde; o erro (`ErroDepoisDoConvite`) manda pedir convite novo.
 * Nada vai para log nem para erro.
 *
 * LIMITE (prova real é [P]): só um Windows de verdade mostra o UAC uma vez e instala/desinstala o túnel.
 */
export function criarEntradaNoGrupo(op: OpcoesEntrada) {
  const execElevado = op.execElevado ?? criarExecutorElevado(undefined, PRAZO_ELEVADO_MS);
  const passo = op.passoMs ?? 250;
  const prazo = op.prazoMs ?? 120_000;
  const arquivo = (n: string): string => join(op.pastaRede, n);
  const conf = arquivo(`${NOME_DO_TUNEL}.conf`);
  const limpar = (): Promise<unknown> =>
    Promise.all(
      [`${NOME_DO_TUNEL}.conf`, ...Object.values(SINAL)].map((n) =>
        rm(arquivo(n), { force: true }),
      ),
    );
  const sinalizar = (n: string): Promise<void> => writeFile(arquivo(n), "", { mode: 0o600 });

  /** Espera o sinal do script; se o executor termina antes (UAC negado, WireGuard ausente), falha na hora. */
  async function esperarPronta(sessao: Promise<unknown>): Promise<void> {
    let terminou: unknown;
    void sessao.then(
      () => (terminou = true),
      () => (terminou = true),
    );
    const fim = Date.now() + prazo;
    while (Date.now() < fim) {
      if (await existe(arquivo(SINAL.pronta))) return;
      if (terminou) break;
      await new Promise((r) => setTimeout(r, passo));
    }
    throw new Error(FALHA_INSTALAR);
  }

  return async function entrar(
    convite: Convite,
    chaves: ParDeChaves,
    guardarToken: (token: string) => Promise<void>,
  ): Promise<{ token: string }> {
    if ((op.plataforma ?? process.platform) !== "win32")
      throw new Error("A rede privada só pode ser instalada no Windows.");
    const provisoria = montarConfigDoPc(
      {
        ip_pc: convite.ipProvisorio,
        chave_publica_hub: convite.chavePublicaHub,
        endpoint: convite.hub,
        allowed_ips: REDE,
      },
      convite.chavePrivadaProvisoria,
    );
    if (!eDoMontador(provisoria)) throw new Error("Config recusada: ela não é só da rede privada.");
    await protegerPastaDaRede({
      pasta: op.pastaRede,
      ...(op.exec ? { exec: op.exec } : {}),
      ...(op.usuario ? { usuario: op.usuario } : {}),
    });
    await limpar();
    let sessao: Promise<unknown> | undefined;
    try {
      await writeFile(conf, provisoria, { mode: 0o600 });
      // UM só pedido de administrador para a entrada inteira.
      sessao = execElevado("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(
          scriptElevado({ pasta: op.pastaRede, espera: ESPERA_SCRIPT_S }),
          "utf16le",
        ).toString("base64"),
      ]);
      sessao.catch(() => undefined); // o erro é tratado quando o app for esperar por ela
      try {
        await esperarPronta(sessao);
      } catch (causa) {
        await sinalizar(SINAL.cancelar).catch(() => undefined);
        throw new Error(FALHA_INSTALAR, { cause: causa });
      }
      const cliente = criarCliente({
        url: `http://${IP_DO_HUB}:${convite.portaCartorio}`,
        cofre: { guardar: async () => {}, ler: async () => undefined },
        ...(op.fetchFn ? { fetchFn: op.fetchFn } : {}),
      });
      let entrada: Awaited<ReturnType<typeof cliente.usarConvite>>;
      try {
        entrada = await cliente.usarConvite(convite.codigo, chaves.publica);
      } catch (erro) {
        await sinalizar(SINAL.cancelar).catch(() => undefined); // o script desinstala a provisória
        await sessao.catch(() => undefined); // best-effort: o erro que importa é o do cartório
        throw erro;
      }
      try {
        await guardarToken(entrada.token);
        await writeFile(conf, montarConfigDoPc(entrada.pacote, chaves.privada), { mode: 0o600 });
        await sinalizar(SINAL.troca);
        await sessao;
      } catch (causa) {
        await sinalizar(SINAL.cancelar).catch(() => undefined);
        await sessao.catch(() => undefined); // espera o script desinstalar antes de a pasta ser limpa
        throw new ErroDepoisDoConvite(FALHA_TROCA, causa);
      }
      return { token: entrada.token };
    } finally {
      await limpar().catch(() => undefined); // nenhuma chave em texto fica na pasta
    }
  };
}
