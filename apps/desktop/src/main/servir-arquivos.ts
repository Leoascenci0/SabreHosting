import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import { arquivoDeMarcas, lerMarcas } from "@sabrehosting/nucleo/backup/rotacao-pasta";
import { criarCliente, ErroCartorio } from "@sabrehosting/nucleo/cartorio/cliente";
import {
  ehEnderecoPrivado,
  PORTA_ESPALHAR,
  servirArquivos,
  type Servidor,
} from "@sabrehosting/nucleo/sync/transferencia";
import { NOME_DO_TUNEL } from "@sabrehosting/nucleo/rede/wireguard";
import { criarVitrine, type Vitrine } from "@sabrehosting/nucleo/sync/vitrine";

/** IP deste PC na rede privada (10.66.0.2–199), lido SÓ da interface do WireGuard; `undefined` se o túnel não está de pé. */
export function ipDaRedePrivada(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | undefined {
  for (const [nome, lista] of Object.entries(interfaces)) {
    if (nome.toLowerCase() !== NOME_DO_TUNEL) continue; // outra placa com IP 10.66.x não vale
    for (const i of lista ?? [])
      if (i.family === "IPv4" && ehEnderecoPrivado(i.address)) return i.address;
  }
  return undefined;
}

/**
 * Confere com o cartório o token que veio no pedido de outro PC (`GET /eu` com o token DELE). Recusado (401) → `null`.
 * Rede ou cartório fora → lança (o servidor responde 503; nunca se aceita sem conferir).
 */
export function conferirTokenNoCartorio(url: string, fetchFn?: typeof fetch) {
  return async (token: string): Promise<string | null> => {
    const cliente = criarCliente({
      url,
      cofre: { guardar: async () => {}, ler: async () => token },
      tentativas: 1,
      ...(fetchFn ? { fetchFn } : {}),
    });
    try {
      return String((await cliente.eu()).id);
    } catch (erro) {
      if (erro instanceof ErroCartorio && erro.tipo === "acesso") return null;
      throw erro;
    }
  };
}

export interface OpcoesServirArquivos {
  /** IP deste PC na rede privada; `undefined` = sem túnel, não liga. */
  endereco: () => string | undefined;
  conferirToken: (token: string) => Promise<string | null>;
  pastaBackups: string;
  /** Pasta própria da vitrine (a cópia aberta do último backup bom que se serve). */
  pastaVitrine: string;
  /** Arquivo das marcas bom/ruim, se não for o padrão ao lado da pasta de backups. */
  arquivoMarcas?: string;
  aoAvisar: (texto: string) => void;
  /** Só para teste: porta, loopback e servidor trocados. */
  porta?: number;
  permitirLoopbackParaTeste?: boolean;
}

/**
 * Faz este PC servir o mundo aos outros pela rede privada (syncmel-1.10). Só liga com IP da rede privada, nunca em
 * 0.0.0.0; serve só a vitrine (cópia conferida de pacote fechado), nunca a pasta do mundo vivo; o token de quem pede é
 * conferido pelo cartório. Um só servidor (`ligar` duas vezes não abre outro) e uma publicação por vez.
 */
export function criarServidorDeArquivos(o: OpcoesServirArquivos) {
  const vitrine: Vitrine = criarVitrine(o.pastaVitrine);
  let servidor: Servidor | undefined;
  let ligando = false;
  let avisouSemRede = false;

  return {
    vitrine,
    /** `true` se está servindo (agora ou já antes). */
    async ligar(): Promise<boolean> {
      if (servidor) return true;
      if (ligando) return false;
      ligando = true; // antes de qualquer await (S-06)
      try {
        const endereco = o.endereco();
        if (!endereco) {
          if (!avisouSemRede) {
            avisouSemRede = true; // a releitura periódica não repete o aviso
            o.aoAvisar(
              "Este PC não está na rede privada do grupo; não passo o mundo aos outros PCs agora.",
            );
          }
          return false;
        }
        servidor = await servirArquivos({
          endereco,
          porta: o.porta ?? PORTA_ESPALHAR,
          conferirToken: o.conferirToken,
          arquivos: (h) => vitrine.arquivos(h),
          ...(o.permitirLoopbackParaTeste ? { permitirLoopbackParaTeste: true } : {}),
        });
        return true;
      } catch (erro) {
        o.aoAvisar(
          `Não consegui passar o mundo aos outros PCs: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
        return false;
      } finally {
        ligando = false;
      }
    },

    /** Põe na vitrine o backup BOM de maior versão (marca "bom" + hash conferido ao abrir). Nunca lança. */
    async publicarUltimoBom(): Promise<void> {
      try {
        const marcas = lerMarcas(o.arquivoMarcas ?? arquivoDeMarcas(o.pastaBackups));
        const melhor = (await listarBackups(o.pastaBackups))
          .filter((b) => marcas.get(b.nome)?.estado === "bom")
          .sort((a, b) => b.versao - a.versao)[0];
        const marca = melhor && marcas.get(melhor.nome);
        if (!melhor || !marca) return;
        await vitrine.publicar(melhor.caminho, marca.sha256);
      } catch (erro) {
        o.aoAvisar(
          `Não atualizei o mundo que passo aos outros PCs: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      }
    },

    /** Relê o IP da rede privada (o túnel pode subir depois do arranque); ao ligar, já põe o último bom na vitrine. */
    async tentarLigar(): Promise<boolean> {
      if (servidor) return true;
      if (!(await this.ligar())) return false;
      await this.publicarUltimoBom();
      return true;
    },

    porta: () => servidor?.porta,

    async fechar(): Promise<void> {
      const s = servidor;
      servidor = undefined;
      await s?.fechar();
      await vitrine.fechar();
    },
  };
}

export type ServidorDeArquivos = ReturnType<typeof criarServidorDeArquivos>;
export const pastaDaVitrine = (dadosDoApp: string): string => join(dadosDoApp, "vitrine");
