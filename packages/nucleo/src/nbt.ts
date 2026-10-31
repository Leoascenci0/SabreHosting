/**
 * Leitor mínimo de NBT (formato do `level.dat` do Minecraft) só para descobrir a versão do mundo importado.
 *
 * O arquivo vem de um zip de fora: é entrada NÃO confiável. Por isso (a) o gunzip tem teto de bytes descompactados,
 * (b) a profundidade é limitada, (c) nenhum comprimento declarado é aceito sem caber no que ainda resta do buffer.
 * Qualquer problema devolve `null` ("desconhecida"): ler a versão nunca derruba nem bloqueia a importação.
 */
import { gunzipSync } from "node:zlib";

export interface VersaoDoMundo {
  nome: string;
  id: number;
}

export interface LimitesDoNbt {
  /** Teto do level.dat descompactado (o de verdade tem poucos KB). */
  maxBytes: number;
}
const PADRAO: LimitesDoNbt = { maxBytes: 16 * 1024 * 1024 };
const MAX_PROFUNDIDADE = 32;

class NbtInvalido extends Error {}

class Leitor {
  pos = 0;
  constructor(readonly b: Buffer) {}
  private pegar(n: number): number {
    if (!Number.isInteger(n) || n < 0 || n > this.b.length - this.pos) throw new NbtInvalido("fim");
    const p = this.pos;
    this.pos += n;
    return p;
  }
  u8() {
    return this.b.readUInt8(this.pegar(1));
  }
  i16() {
    return this.b.readInt16BE(this.pegar(2));
  }
  i32() {
    return this.b.readInt32BE(this.pegar(4));
  }
  pular(n: number) {
    this.pegar(n);
  }
  texto(): string {
    const n = this.b.readUInt16BE(this.pegar(2));
    return this.b.toString("utf8", this.pegar(n), this.pos);
  }
}

/** Largura em bytes de cada elemento dos tipos de tamanho fixo (1 byte … double). */
const LARGURA: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8 };

function pularPayload(l: Leitor, tipo: number, prof: number): void {
  if (prof > MAX_PROFUNDIDADE) throw new NbtInvalido("fundo demais");
  const larg = LARGURA[tipo];
  if (larg !== undefined) return l.pular(larg);
  if (tipo === 7 || tipo === 11 || tipo === 12) {
    const n = l.i32();
    return l.pular(n * (tipo === 7 ? 1 : tipo === 11 ? 4 : 8)); // pegar() rejeita n negativo ou além do buffer
  }
  if (tipo === 8) return void l.texto();
  if (tipo === 9) {
    const t = l.u8();
    const n = l.i32();
    if (n < 0 || (t === 0 && n > 0)) throw new NbtInvalido("lista");
    const w = LARGURA[t];
    if (w !== undefined) return l.pular(n * w);
    for (let i = 0; i < n; i++) pularPayload(l, t, prof + 1); // cada elemento consome ≥1 byte ou lança
    return;
  }
  if (tipo === 10) {
    for (;;) {
      const t = l.u8();
      if (t === 0) return;
      l.texto();
      pularPayload(l, t, prof + 1);
    }
  }
  throw new NbtInvalido("tipo");
}

/** Lê os filhos de um compound; `quando` pode tratar um filho e devolver true (senão ele é pulado). */
function filhos(l: Leitor, prof: number, quando: (nome: string, tipo: number) => boolean): void {
  if (prof > MAX_PROFUNDIDADE) throw new NbtInvalido("fundo demais");
  for (;;) {
    const t = l.u8();
    if (t === 0) return;
    const nome = l.texto();
    if (!quando(nome, t)) pularPayload(l, t, prof + 1);
  }
}

/** Devolve `Data.Version.Name`/`Id` do level.dat (gzip), ou `null` se ausente ou ilegível. Nunca lança. */
export function lerVersaoDoLevelDat(
  gz: Buffer,
  limites: Partial<LimitesDoNbt> = {},
): VersaoDoMundo | null {
  try {
    const { maxBytes } = { ...PADRAO, ...limites };
    const l = new Leitor(gunzipSync(gz, { maxOutputLength: maxBytes }));
    if (l.u8() !== 10) return null;
    l.texto();
    let nome: string | undefined;
    let id: number | undefined;
    filhos(l, 0, (n1, t1) => {
      if (n1 !== "Data" || t1 !== 10) return false;
      filhos(l, 1, (n2, t2) => {
        if (n2 !== "Version" || t2 !== 10) return false;
        filhos(l, 2, (n3, t3) => {
          if (n3 === "Name" && t3 === 8) nome = l.texto();
          else if (n3 === "Id" && t3 === 3) id = l.i32();
          else return false;
          return true;
        });
        return true;
      });
      return true;
    });
    return nome !== undefined && id !== undefined ? { nome, id } : null;
  } catch {
    return null;
  }
}
