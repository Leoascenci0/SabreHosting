/**
 * Lista os backups de uma pasta para a tela: abre só a PRIMEIRA entrada de cada pacote (o `manifesto.json`) e para.
 * Só lê (regras de ouro 3 e 4): pacote ilegível ou parcial é ignorado, nunca apagado nem alterado.
 */
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Parser } from "tar";
import { origemDoManifesto, validarManifesto, type OrigemBackup } from "./manifesto.js";

export interface BackupListado {
  /** Nome do arquivo na pasta de backups (`<data>-v<versao>.tar.gz`). */
  nome: string;
  caminho: string;
  criadoEm: string;
  versao: number;
  /** Soma dos arquivos do mundo dentro do pacote, em bytes. */
  tamanho: number;
  /** Quem fez: relógio, botão ou a cópia de segurança antes de restaurar (antigo sem campo = automático). */
  origem: OrigemBackup;
}

const MAX_MANIFESTO = 64 * 1024 * 1024;

async function lerManifesto(caminho: string) {
  const origem = createReadStream(caminho);
  return new Promise<ReturnType<typeof validarManifesto>>((ok, falhar) => {
    let feito = false;
    const fim = (f: () => void): void => {
      if (feito) return;
      feito = true;
      origem.destroy();
      f();
    };
    const parser = new Parser({
      onReadEntry: (entrada) => {
        if (entrada.path !== "manifesto.json" || entrada.size > MAX_MANIFESTO) {
          entrada.resume();
          return fim(() => falhar(new Error("sem manifesto")));
        }
        const partes: Buffer[] = [];
        entrada.on("data", (p: Buffer) => partes.push(p));
        entrada.on("end", () => {
          try {
            const m = validarManifesto(JSON.parse(Buffer.concat(partes).toString("utf8")));
            fim(() => ok(m));
          } catch (e) {
            fim(() => falhar(e as Error));
          }
        });
      },
    });
    parser.on("error", (e) => fim(() => falhar(e)));
    origem.on("error", (e) => fim(() => falhar(e)));
    origem.on("close", () => fim(() => falhar(new Error("pacote vazio"))));
    origem.pipe(parser);
  });
}

export async function listarBackups(pastaBackups: string): Promise<BackupListado[]> {
  const nomes = await readdir(pastaBackups).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  const lista: BackupListado[] = [];
  for (const nome of nomes.filter((n) => n.endsWith(".tar.gz"))) {
    const caminho = join(pastaBackups, nome);
    try {
      const m = await lerManifesto(caminho);
      const tamanho = m.arquivos.reduce((soma, a) => soma + a.tamanho, 0);
      lista.push({
        nome,
        caminho,
        criadoEm: m.criadoEm,
        versao: m.versao,
        tamanho,
        origem: origemDoManifesto(m),
      });
    } catch {
      // pacote ilegível: fica de fora da lista, intacto no disco
    }
  }
  return lista.sort(
    (a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm) || (a.nome < b.nome ? 1 : -1),
  );
}
