import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Cofre } from "@sabrehosting/nucleo/cartorio/cofre";
import { lerConvite, type Convite } from "@sabrehosting/nucleo/rede/convite";
import type { ParDeChaves } from "@sabrehosting/nucleo/rede/wireguard";
import { gerarEula, gravarAtomico, perguntaEula } from "@sabrehosting/nucleo/servidor/configurar";
import type { ConviteConferido, EntradaNoGrupo, EstadoBoasVindas, Resultado } from "../ui/ponte.js";

/**
 * Assistente de primeira vez (app-1.3b): Convite → EULA → Pasta. O texto do convite, as chaves e o token ficam só
 * aqui no main; a janela recebe apenas o nome do grupo, o prazo e mensagens fixas.
 */
export interface DepsBoasVindas {
  /** Pasta de dados do app (onde mora `boas-vindas.json`). */
  dados: string;
  agora(): number;
  gerarChaves(): ParDeChaves;
  /** O cofre do sistema existe? Conferido ANTES de gastar o convite (que só vale uma vez). */
  cofreDisponivel(): boolean;
  cofre: Cofre & { estado?(): Promise<{ tipo: string }> };
  /** Passo elevado: conexão provisória → usar o convite → conexão definitiva com a chave própria. Devolve o token. */
  entrar(
    convite: Convite,
    chaves: ParDeChaves,
    /** Guarda o token no cofre; o passo elevado chama assim que o cartório responde, antes de mexer na rede. */
    guardarToken: (token: string) => Promise<void>,
  ): Promise<{ token: string }>;
  /** `GET /grupo` já com o token novo. */
  lerGrupo(token: string, portaCartorio: number): Promise<{ nome: string; endereco_jogar: string }>;
  pastaPadrao(): string;
}

export interface Salvo {
  grupo?: { nome: string; endereco?: string };
  concluido?: boolean;
  pastaBase?: string;
  /** Porta do cartório na rede privada (do convite). O token nunca vem para este arquivo (fica no cofre). */
  portaCartorio?: number;
}

const ARQUIVO = "boas-vindas.json";
const SEM_CONVITE = "Cole o convite e confira antes de entrar no grupo.";
const JA_USADO =
  "Esse convite já foi usado ou venceu. Peça um convite novo para quem administra o grupo.";
const VENCEU = "Esse convite venceu. Peça um convite novo para quem administra o grupo.";
const SEM_COFRE =
  "Este computador não tem um cofre seguro disponível (o Windows não liberou a proteção das senhas). Por segurança, o SabreHosting não entra no grupo sem ele. O convite não foi usado.";
const GENERICA =
  "Não consegui entrar no grupo agora. Confira se você aceitou o pedido de administrador do Windows e tente de novo.";
const SEM_ACEITE = "Aceite o contrato da Mojang para continuar.";
const SEM_GRUPO = "Entre no grupo com o convite antes de continuar.";
const PASTA_INVALIDA =
  "Escolha uma pasta completa (por exemplo, C:\\Jogos\\SabreHosting), não a raiz do disco.";
const FALHA_PASTA = "Não consegui preparar a pasta. Escolha outra.";
const PASSOU_A_JANELA =
  "Passaram 30 minutos desde que esse convite foi usado, então ele não serve mais. Peça um convite novo para quem administra o grupo.";
/** O cartório só reemite a conexão para o mesmo PC até 30 min depois do uso (Eliel, 01/11; JANELA_REPETICAO_MS). */
const JANELA_RETOMADA_MS = 30 * 60_000;

/**
 * A pasta-base vinda da janela: texto, caminho completo, sem `..`, fora da raiz do disco e das pastas do sistema
 * (Windows, Program Files). Confere pelo texto, igual em qualquer sistema.
 */
export function pastaPermitida(pasta: unknown): pasta is string {
  if (typeof pasta !== "string" || pasta.length === 0 || pasta.length > 240) return false;
  if (pasta.includes("\0")) return false;
  const completa = /^[A-Za-z]:[\\/]/.test(pasta) || isAbsolute(pasta);
  if (!completa) return false;
  const segmentos = pasta.split(/[\\/]+/).filter((x) => x !== "");
  if (segmentos.includes("..") || segmentos.includes(".")) return false;
  const util = segmentos.filter((x, i) => !(i === 0 && /^[A-Za-z]:$/.test(x)));
  if (util.length === 0 || dirname(pasta) === pasta) return false; // raiz do disco
  const primeiro = util[0]?.toLowerCase() ?? "";
  return !(
    /^[A-Za-z]:/.test(pasta) &&
    ["windows", "program files", "program files (x86)", "programdata"].includes(primeiro)
  );
}

/** O que o assistente gravou; a configuração do app (`config-pc.ts`) parte daqui. Arquivo torto = tudo ausente. */
export function lerSalvo(dados: string): Salvo {
  try {
    const v: unknown = JSON.parse(readFileSync(join(dados, ARQUIVO), "utf8"));
    if (typeof v !== "object" || v === null) return {};
    const o = v as Record<string, unknown>;
    const g = o["grupo"] as Record<string, unknown> | null | undefined;
    return {
      ...(typeof g?.["nome"] === "string"
        ? {
            grupo: {
              nome: g["nome"],
              ...(typeof g["endereco"] === "string" ? { endereco: g["endereco"] } : {}),
            },
          }
        : {}),
      ...(typeof o["portaCartorio"] === "number" &&
      Number.isInteger(o["portaCartorio"]) &&
      o["portaCartorio"] >= 1 &&
      o["portaCartorio"] <= 65535
        ? { portaCartorio: o["portaCartorio"] }
        : {}),
      ...(o["concluido"] === true && typeof o["pastaBase"] === "string"
        ? { concluido: true, pastaBase: o["pastaBase"] }
        : {}),
    };
  } catch {
    return {};
  }
}

/** Troca atômica (regra de ouro 3). Nunca recebe token, convite nem chave. */
export function gravarSalvo(dados: string, s: Salvo): void {
  mkdirSync(dados, { recursive: true });
  const temporario = join(dados, `${ARQUIVO}.tmp`);
  writeFileSync(temporario, JSON.stringify(s, null, 2));
  renameSync(temporario, join(dados, ARQUIVO));
}

/** A mensagem de um erro só passa se não carregar segredo; o convite e as chaves nunca saem daqui. */
function mensagemSegura(e: unknown, segredos: string[]): string {
  const falha = e as { status?: unknown; tipo?: unknown } | null;
  // 401 do cartório vira `tipo: "acesso"` no cliente (convite usado, vencido ou desconhecido).
  if (falha?.status === 401 || falha?.tipo === "acesso") return JA_USADO;
  if (!(e instanceof Error) || e.message === "") return GENERICA;
  return segredos.some((s) => s !== "" && e.message.includes(s)) ? GENERICA : e.message;
}

export function criarBoasVindas(deps: DepsBoasVindas) {
  // Convite, chaves e retomada ficam SÓ em memória (nunca em disco): fechou o app, pede convite novo.
  let convite: Convite | undefined;
  /** Nascem no 1º `entrar` deste convite; a repetição precisa da MESMA chave (o cartório só reemite para ela). */
  let chaves: ParDeChaves | undefined;
  /** Instante em que a entrada falhou com o convite já gasto: "Tentar de novo" vale até 30 min depois. */
  let gastoEm: number | undefined;
  const esquecer = (): void => {
    convite = chaves = gastoEm = undefined;
  };
  let aceitoEm: Date | undefined;
  let entrando = false;

  return {
    async estado(): Promise<EstadoBoasVindas> {
      const salvo = lerSalvo(deps.dados);
      const pastaPadrao = deps.pastaPadrao();
      if (salvo.concluido) {
        // PC configurado, mas o token no cofre não decifra: não é a primeira vez, precisa de convite novo.
        const e = await deps.cofre.estado?.().catch(() => undefined);
        if (e?.tipo !== "corrompido") return { aberto: false };
        return { aberto: true, passo: "convite", pastaPadrao, cofreCorrompido: true };
      }
      if (!salvo.grupo) return { aberto: true, passo: "convite", pastaPadrao };
      return {
        aberto: true,
        passo: aceitoEm ? "pasta" : "eula",
        grupo: salvo.grupo,
        pastaPadrao,
      };
    },

    /** Confere formato e prazo ANTES de tudo (nada de rede, nada de disco). */
    async conferirConvite(entrada: unknown): Promise<ConviteConferido> {
      const r = lerConvite(typeof entrada === "string" ? entrada : "", deps.agora());
      // Conferir de novo o MESMO convite não perde a chave (a repetição precisa dela); outro convite recomeça.
      if (!r.ok || r.convite.codigo !== convite?.codigo) esquecer();
      if (!r.ok) return { ok: false, mensagem: r.mensagem };
      convite = r.convite;
      return { ok: true, grupo: r.convite.grupo, venceEm: r.convite.venceEm };
    },

    async entrar(): Promise<EntradaNoGrupo> {
      if (entrando) return { ok: false, mensagem: "Já estou entrando no grupo." };
      const usar = convite;
      if (!usar) return { ok: false, mensagem: SEM_CONVITE };
      // O app usa `>=` (aos 30 min exatos já desiste); o cartório usa `>` (ainda aceita). Mais estrito aqui, de propósito.
      if (gastoEm !== undefined && deps.agora() - gastoEm >= JANELA_RETOMADA_MS) {
        esquecer();
        return { ok: false, mensagem: PASSOU_A_JANELA };
      }
      if (usar.venceEm <= deps.agora()) {
        esquecer();
        return { ok: false, mensagem: VENCEU };
      }
      if (!deps.cofreDisponivel()) return { ok: false, mensagem: SEM_COFRE };
      entrando = true;
      const minhas = (chaves ??= deps.gerarChaves());
      const segredos = [usar.codigo, usar.chavePrivadaProvisoria, minhas.privada];
      try {
        let guardado = false;
        const guardar = async (t: string): Promise<void> => {
          segredos.push(t);
          await deps.cofre.guardar(t);
          guardado = true;
        };
        let token: string;
        try {
          ({ token } = await deps.entrar(usar, minhas, guardar));
        } catch (e) {
          const falha = e as { conviteGasto?: unknown; status?: unknown; tipo?: unknown } | null;
          // Cartório aceitou mas a conexão falhou: guarda o instante (a janela conta do 1º uso).
          if (falha?.conviteGasto === true) gastoEm ??= deps.agora();
          // Cartório recusou (usado por outro, vencido, janela passada): não adianta repetir.
          else if (falha?.status === 401 || falha?.tipo === "acesso") esquecer();
          throw e;
        }
        esquecer(); // usado: não serve de novo
        if (!guardado) await guardar(token);
        let grupo: { nome: string; endereco?: string } = { nome: usar.grupo };
        try {
          const g = await deps.lerGrupo(token, usar.portaCartorio);
          grupo = { nome: g.nome, endereco: g.endereco_jogar };
        } catch {
          // Já entrou; o nome do convite basta e o endereço vem depois pelo Início.
        }
        gravarSalvo(deps.dados, { grupo, portaCartorio: usar.portaCartorio });
        return {
          ok: true,
          grupo: grupo.nome,
          ...(grupo.endereco ? { endereco: grupo.endereco } : {}),
        };
      } catch (e) {
        return {
          ok: false,
          mensagem: mensagemSegura(e, segredos),
          ...(gastoEm !== undefined ? { tentarDeNovo: true as const } : {}),
        };
      } finally {
        entrando = false;
      }
    },

    eula: () => perguntaEula(),

    /** Só `true` conta como aceite; o aceite é da pessoa, na tela. */
    async aceitarEula(aceito: unknown): Promise<Resultado> {
      if (aceito !== true) {
        aceitoEm = undefined;
        return { ok: false, mensagem: SEM_ACEITE };
      }
      if (!lerSalvo(deps.dados).grupo) return { ok: false, mensagem: SEM_GRUPO };
      aceitoEm = new Date(deps.agora());
      return { ok: true };
    },

    /** Cria `servidor\` e `mundos\`, grava o EULA aceito e só então marca o PC como configurado. */
    async concluir(pasta: unknown): Promise<Resultado> {
      const salvo = lerSalvo(deps.dados);
      if (!salvo.grupo) return { ok: false, mensagem: SEM_GRUPO };
      if (!aceitoEm) return { ok: false, mensagem: SEM_ACEITE };
      // A pasta vem da janela: validada aqui no main (nunca confiar na tela).
      if (!pastaPermitida(pasta)) return { ok: false, mensagem: PASTA_INVALIDA };
      try {
        await mkdir(join(pasta, "servidor"), { recursive: true });
        await mkdir(join(pasta, "mundos"), { recursive: true });
        await gravarAtomico(join(pasta, "servidor", "eula.txt"), gerarEula({ aceitoEm }));
        gravarSalvo(deps.dados, { ...salvo, concluido: true, pastaBase: pasta });
        return { ok: true };
      } catch {
        return { ok: false, mensagem: FALHA_PASTA };
      }
    },
  };
}

export type BoasVindas = ReturnType<typeof criarBoasVindas>;
