import { execFile } from "node:child_process";
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execReal, type ExecArquivo } from "../launcher/prism.js";

/**
 * Pacote que o hub entrega a um PC convidado (saída de `infra/vps/wg/adicionar-pc.sh`). Só traz o que é público:
 * a chave privada do PC nasce no PC e a do hub nunca sai do hub.
 */
export interface PacoteDeLigacao {
  ip_pc: string;
  chave_publica_hub: string;
  endpoint: string;
  allowed_ips: string;
}

export interface ParDeChaves {
  privada: string;
  publica: string;
}

export const IP_DO_HUB = "10.66.0.1";
const REDE = "10.66.0.0/24";
const NOME_DO_TUNEL = "sabre";
const WIREGUARD_EXE = "C:\\Program Files\\WireGuard\\wireguard.exe";
/** Prefixo PKCS#8 de uma chave privada X25519 (RFC 8410); depois vêm os 32 bytes da chave. */
const PKCS8_X25519 = Buffer.from("302e020100300506032b656e04220420", "hex");

/** 44 caracteres de base64 = 32 bytes (o 43º símbolo só pode ter os 2 bits finais zerados). */
function chaveValida(k: unknown): k is string {
  return typeof k === "string" && /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(k);
}

/** Deriva a chave pública (X25519) de uma privada em base64. Nunca repete o texto recebido nos erros. */
export function derivarChavePublica(privada: string): string {
  if (!chaveValida(privada)) throw new Error("Chave privada inválida.");
  const der = Buffer.concat([PKCS8_X25519, Buffer.from(privada, "base64")]);
  const jwk = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({
    format: "jwk",
  });
  return Buffer.from(jwk.x ?? "", "base64url").toString("base64");
}

/**
 * Gera o par de chaves do PC AQUI, no PC. Usa o X25519 do Node (mesma curva do WireGuard) em vez do `wg genkey`:
 * não depende de o WireGuard já estar instalado e a chave privada não passa por processo filho nem por pipe.
 * O ajuste dos bits (clamp) é o mesmo do `wg genkey`.
 */
export function gerarChavesDoPc(): ParDeChaves {
  const b = randomBytes(32);
  b[0] = (b[0] ?? 0) & 248;
  b[31] = ((b[31] ?? 0) & 127) | 64;
  const privada = b.toString("base64");
  return { privada, publica: derivarChavePublica(privada) };
}

/** Confere cada campo do pacote (ele pode vir da rede): um campo torto poderia injetar linhas na config. */
export function validarPacote(entrada: unknown): PacoteDeLigacao {
  const p = (entrada ?? {}) as Partial<Record<keyof PacoteDeLigacao, unknown>>;
  const ip = /^10\.66\.0\.(0|[1-9]\d{0,2})$/.exec(String(p.ip_pc));
  const final = Number(ip?.[1]);
  if (!ip || typeof p.ip_pc !== "string" || final < 2 || final > 254)
    throw new Error("Pacote de ligação inválido: endereço do PC.");
  if (!chaveValida(p.chave_publica_hub))
    throw new Error("Pacote de ligação inválido: chave pública do hub.");
  const ponto =
    typeof p.endpoint === "string" ? /^[A-Za-z0-9.-]+:(\d{1,5})$/.exec(p.endpoint) : null;
  if (!ponto || Number(ponto[1]) > 65535)
    throw new Error("Pacote de ligação inválido: endereço do hub.");
  if (p.allowed_ips !== REDE) throw new Error("Pacote de ligação inválido: rede permitida.");
  return {
    ip_pc: p.ip_pc,
    chave_publica_hub: p.chave_publica_hub,
    endpoint: p.endpoint as string,
    allowed_ips: p.allowed_ips,
  };
}

/**
 * Monta a configuração do WireGuard do PC. PURA. Sem `DNS` e só a rede privada em `AllowedIPs`
 * (nunca `0.0.0.0/0`: a internet do amigo continua passando pela rota dele).
 */
export function montarConfigDoPc(entrada: unknown, chavePrivada: string): string {
  const p = validarPacote(entrada);
  if (!chaveValida(chavePrivada)) throw new Error("Chave privada inválida.");
  return [
    "[Interface]",
    `PrivateKey = ${chavePrivada}`,
    `Address = ${p.ip_pc}/24`,
    "",
    "[Peer]",
    `PublicKey = ${p.chave_publica_hub}`,
    `Endpoint = ${p.endpoint}`,
    `AllowedIPs = ${p.allowed_ips}`,
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

const PROIBIDO_NA_CONFIG = /0\.0\.0\.0\/0|::\/0|^\s*(DNS|PreUp|PostUp|PreDown|PostDown)\s*=/im;

export interface OpcoesAplicar {
  /** Pasta do app para o .conf temporário (ex.: %LOCALAPPDATA%\SabreHosting\rede). */
  pasta: string;
  /** Roda sem administrador (`icacls`). Padrão: execFile sem shell. */
  exec?: ExecArquivo;
  /** Roda o `wireguard.exe` com administrador (pede o UAC). Padrão: `criarExecutorElevado()`. */
  execElevado?: ExecArquivo;
  wireguardExe?: string;
  /** Padrão: process.platform. */
  plataforma?: string;
  /** Conta do Windows que mantém acesso à pasta. Padrão: USERNAME. */
  usuario?: string;
}

/**
 * Instala a rede privada no Windows: protege a pasta, grava o .conf, manda o WireGuard instalar o túnel (pede
 * administrador uma vez) e apaga o .conf em texto (o WireGuard guarda a própria cópia protegida). A chave privada
 * só existe em texto entre a gravação e a instalação; nada vai para log nem para mensagem de erro.
 */
export async function aplicarNoWindows(cfg: string, op: OpcoesAplicar): Promise<void> {
  if ((op.plataforma ?? process.platform) !== "win32")
    throw new Error("A rede privada só pode ser instalada no Windows.");
  if (PROIBIDO_NA_CONFIG.test(cfg))
    throw new Error("Config recusada: ela não é só da rede privada.");
  const exec = op.exec ?? execReal;
  const execElevado = op.execElevado ?? criarExecutorElevado();
  const usuario = op.usuario ?? process.env.USERNAME ?? "";
  if (usuario === "") throw new Error("Não sei qual é a conta do Windows para proteger a pasta.");

  await mkdir(op.pasta, { recursive: true, mode: 0o700 });
  await chmod(op.pasta, 0o700);
  try {
    // Só o próprio usuário, o sistema e os administradores (o serviço do WireGuard precisa ler).
    await exec("icacls", [
      op.pasta,
      "/inheritance:r",
      "/grant:r",
      `${usuario}:(OI)(CI)F`,
      "*S-1-5-18:(OI)(CI)F",
      "*S-1-5-32-544:(OI)(CI)F",
    ]);
  } catch (causa) {
    throw new Error("Não consegui proteger a pasta da rede privada; nada foi instalado.", {
      cause: causa,
    });
  }

  const arquivo = join(op.pasta, `${NOME_DO_TUNEL}.conf`);
  try {
    await writeFile(arquivo, cfg, { mode: 0o600 });
    await execElevado(op.wireguardExe ?? WIREGUARD_EXE, ["/installtunnelservice", arquivo]);
  } catch (causa) {
    throw new Error(
      "Não consegui instalar a rede privada. Ela precisa da permissão de administrador do Windows e do WireGuard instalado.",
      { cause: causa },
    );
  } finally {
    await rm(arquivo, { force: true });
  }
}

type ExecFileFn = typeof execFile;
const PRAZO_ELEVADO_MS = 60_000;
// Programa e argumentos chegam por variável de ambiente: o caminho nunca é montado dentro do texto do comando.
const COMANDO_ELEVADO =
  "$a = @(ConvertFrom-Json $env:SABRE_ARGS); " +
  "$p = Start-Process -FilePath $env:SABRE_EXE -ArgumentList ($a | ForEach-Object { '\"' + $_ + '\"' }) -Verb RunAs -Wait -PassThru; " +
  "exit $p.ExitCode";

/** Executor que roda um programa com administrador (janela do UAC). Sem shell; o execFile é injetável para teste. */
export function criarExecutorElevado(execFileFn: ExecFileFn = execFile): ExecArquivo {
  return (arquivo, args) =>
    new Promise((ok, falha) => {
      execFileFn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", COMANDO_ELEVADO],
        {
          shell: false,
          windowsHide: true,
          timeout: PRAZO_ELEVADO_MS,
          encoding: "utf8",
          env: { ...process.env, SABRE_EXE: arquivo, SABRE_ARGS: JSON.stringify(args) },
        },
        (erro, saida) => (erro ? falha(erro) : ok(String(saida))),
      );
    });
}

export interface OpcoesTestarLigacao {
  exec?: ExecArquivo;
  /** Prazo de cada tentativa (padrão 3 s). */
  prazoMs?: number;
  tentativas?: number;
  pausaMs?: number;
}

/**
 * Alcança o hub pela rede privada (`ping` a 10.66.0.1). O Windows sai com 0 até em "host inacessível"; por isso
 * só vale com `TTL=` na resposta. Tenta algumas vezes porque o primeiro aperto de mão do túnel demora.
 */
export async function testarLigacao(
  op: OpcoesTestarLigacao = {},
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const exec = op.exec ?? execReal;
  const prazo = op.prazoMs ?? 3000;
  const tentativas = op.tentativas ?? 3;
  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, op.pausaMs ?? 1000));
    let timer: NodeJS.Timeout | undefined;
    try {
      const saida = await Promise.race([
        exec("ping", ["-n", "1", "-w", String(prazo), IP_DO_HUB]),
        new Promise<never>((_, falha) => {
          timer = setTimeout(() => falha(new Error("prazo")), prazo + 500);
        }),
      ]);
      if (/TTL=/i.test(saida)) return { ok: true };
    } catch {
      // tenta de novo
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, motivo: "O hub não respondeu pela rede privada." };
}
