import { crc32, deflateRawSync } from "node:zlib";

export interface EntradaDeZip {
  nome: string;
  dados?: Buffer;
  /** Permissões Unix (ex.: 0o120777 = link simbólico). Padrão: arquivo comum 0o100644. */
  modo?: number;
  /** 0 = sem compressão, 8 = deflate (padrão). */
  metodo?: 0 | 8;
  /** Para zip hostil: o tamanho que o cabeçalho DIZ (mente sobre o real). */
  tamanhoDeclarado?: number;
}

/** Monta um .zip pequeno na memória (só para teste; mundo inventado). Aceita nomes e cabeçalhos hostis de propósito. */
export function montarZip(entradas: EntradaDeZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let posicao = 0;
  for (const e of entradas) {
    const nome = Buffer.from(e.nome, "utf8");
    const bruto = e.dados ?? Buffer.alloc(0);
    const metodo = e.metodo ?? 8;
    const dados = metodo === 8 ? deflateRawSync(bruto) : bruto;
    const declarado = e.tamanhoDeclarado ?? bruto.length;
    const crc = crc32(bruto);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(declarado, 22);
    local.writeUInt16LE(nome.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(declarado, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(((e.modo ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(posicao, 42);
    locais.push(local, nome, dados);
    centrais.push(central, nome);
    posicao += local.length + nome.length + dados.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(posicao, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}
