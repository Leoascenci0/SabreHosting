import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface OpcoesServidor {
  /** IP deste PC na rede privada (WireGuard). Nunca 0.0.0.0 nem IP público. */
  ipRedePrivada: string;
  /** Porta do servidor; só vale dentro da rede privada. Padrão: 25565. */
  porta?: number;
  /** Configurações › Servidor › Distância de visão. Padrão: 10. */
  distanciaVisao?: number;
  /** Configurações › Servidor › Distância de simulação (5–32). Padrão: 8. */
  distanciaSimulacao?: number;
}

/** Aceite dado pelo usuário na tela; o núcleo nunca aceita o EULA por ninguém. */
export interface AceiteEula {
  aceitoEm: Date;
}

const LINK_EULA = "https://aka.ms/MinecraftEULA";
const IP_PRIVADO = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/;

function octetosValidos(ip: string): boolean {
  return ip.split(".").every((o) => Number(o) <= 255);
}

function validarFaixa(valor: number, nome: string, min: number, max: number): void {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`A ${nome} precisa ser um número inteiro entre ${min} e ${max}.`);
  }
}

/** Texto do `server.properties`. O proxy confere a conta; aqui só se escuta na rede privada. */
export function gerarPropriedades(opcoes: OpcoesServidor): string {
  const { ipRedePrivada: ip, porta = 25565, distanciaVisao = 10, distanciaSimulacao = 8 } = opcoes;
  if (!IP_PRIVADO.test(ip) || !octetosValidos(ip)) {
    throw new Error(
      "O IP do servidor precisa ser o da rede privada (ex.: 10.x.x.x); nunca 0.0.0.0 nem IP público.",
    );
  }
  validarFaixa(porta, "porta", 1024, 65535);
  validarFaixa(distanciaVisao, "distância de visão", 3, 32);
  validarFaixa(distanciaSimulacao, "distância de simulação", 5, 32);
  if (distanciaSimulacao >= distanciaVisao) {
    throw new Error("A distância de simulação precisa ser menor que a distância de visão.");
  }
  return [
    `server-ip=${ip}`,
    `server-port=${porta}`,
    "online-mode=false",
    "white-list=true",
    "enforce-whitelist=true",
    "enable-rcon=false",
    `view-distance=${distanciaVisao}`,
    `simulation-distance=${distanciaSimulacao}`,
    "",
  ].join("\n");
}

/** `eula=true` só com aceite explícito do usuário. */
export function gerarEula(aceite?: AceiteEula): string {
  const aceitou = aceite !== undefined && !Number.isNaN(aceite.aceitoEm.getTime());
  const cabecalho = `# EULA da Mojang: ${LINK_EULA}\n`;
  const quando = aceitou ? `# Aceito pelo usuário em ${aceite.aceitoEm.toISOString()}\n` : "";
  return `${cabecalho}${quando}eula=${aceitou}\n`;
}

/** A pergunta que a tela (app-1.x) mostra antes de pedir o aceite. */
export function perguntaEula(): { texto: string; link: string } {
  return {
    texto:
      "Para hospedar um servidor de Minecraft é preciso aceitar o EULA (contrato de uso) da Mojang. " +
      "Leia no link e aceite só se concordar.",
    link: LINK_EULA,
  };
}

/** O servidor só sobe com `eula=true` na pasta. */
export async function podeSubir(pasta: string): Promise<{ pode: boolean; motivo?: string }> {
  const recusa = { pode: false, motivo: "Aceite o EULA da Mojang antes de ligar o servidor." };
  let texto: string;
  try {
    texto = await readFile(join(pasta, "eula.txt"), "utf8");
  } catch {
    return recusa;
  }
  // Só a linha exata, sem espaço e sem comentário (aceita CRLF do Windows).
  return texto.split(/\r?\n/).includes("eula=true") ? { pode: true } : recusa;
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

async function gravarAtomico(destino: string, conteudo: string): Promise<void> {
  const temp = `${destino}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, conteudo);
    await rename(temp, destino);
  } catch (erro) {
    await rm(temp, { force: true });
    throw erro;
  }
}

/** Valida tudo antes de escrever; grava os dois arquivos por temporário + rename. */
export async function gravarConfiguracao(
  pasta: string,
  opcoes: OpcoesServidor,
  aceite?: AceiteEula,
): Promise<void> {
  const propriedades = gerarPropriedades(opcoes);
  const eula = gerarEula(aceite);
  await gravarAtomico(join(pasta, "server.properties"), propriedades);
  // Sem novo aceite, o eula.txt que já existe fica como está (mudar a distância não desfaz o aceite).
  if (aceite === undefined && (await existe(join(pasta, "eula.txt")))) return;
  await gravarAtomico(join(pasta, "eula.txt"), eula);
}
