import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import type { Convite } from "@sabrehosting/nucleo/rede/convite";
import {
  aplicarNoWindows,
  criarExecutorElevado,
  IP_DO_HUB,
  montarConfigDoPc,
  NOME_DO_TUNEL,
  type ParDeChaves,
  type OpcoesAplicar,
} from "@sabrehosting/nucleo/rede/wireguard";
import type { ExecArquivo } from "@sabrehosting/nucleo/launcher/prism";

const REDE = "10.66.0.0/24";
const WIREGUARD_EXE = "C:\\Program Files\\WireGuard\\wireguard.exe";

export interface OpcoesEntrada {
  /** Pasta protegida do app para o .conf temporário. */
  pastaRede: string;
  aplicar?: (cfg: string, op: OpcoesAplicar) => Promise<void>;
  execElevado?: ExecArquivo;
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

/**
 * Passo elevado da entrada no grupo (spec §5.2, item 3): instala a conexão provisória com a chave do convite, usa o
 * convite no cartório (só alcançável por ela), troca pela conexão definitiva com a chave própria e devolve o token.
 * - Cartório recusou (usado, vencido, fora do ar): a provisória é desinstalada (sem esconder o erro original) e a
 *   chave própria nunca é instalada.
 * - O token vai para o cofre (`guardarToken`) assim que o cartório responde, ANTES dos passos elevados: se a troca
 *   falhar, o token não se perde; o erro (`ErroDepoisDoConvite`) manda pedir convite novo.
 * Nada vai para log nem para erro.
 *
 * LIMITE (prova real é [P]): cada instalar/desinstalar do WireGuard pede o administrador do Windows; fundir tudo num
 * único pedido fica como melhoria.
 */
export function criarEntradaNoGrupo(op: OpcoesEntrada) {
  const aplicar = op.aplicar ?? aplicarNoWindows;
  const execElevado = op.execElevado ?? criarExecutorElevado();
  const desinstalar = () => execElevado(WIREGUARD_EXE, ["/uninstalltunnelservice", NOME_DO_TUNEL]);
  return async function entrar(
    convite: Convite,
    chaves: ParDeChaves,
    guardarToken: (token: string) => Promise<void>,
  ): Promise<{ token: string }> {
    const provisoria = montarConfigDoPc(
      {
        ip_pc: convite.ipProvisorio,
        chave_publica_hub: convite.chavePublicaHub,
        endpoint: convite.hub,
        allowed_ips: REDE,
      },
      convite.chavePrivadaProvisoria,
    );
    await aplicar(provisoria, { pasta: op.pastaRede, execElevado });
    const cliente = criarCliente({
      url: `http://${IP_DO_HUB}:${convite.portaCartorio}`,
      cofre: { guardar: async () => {}, ler: async () => undefined },
      ...(op.fetchFn ? { fetchFn: op.fetchFn } : {}),
    });
    let entrada: Awaited<ReturnType<typeof cliente.usarConvite>>;
    try {
      entrada = await cliente.usarConvite(convite.codigo, chaves.publica);
    } catch (erro) {
      await desinstalar().catch(() => undefined); // best-effort: o erro que importa é o do cartório
      throw erro;
    }
    try {
      await guardarToken(entrada.token);
      const definitiva = montarConfigDoPc(entrada.pacote, chaves.privada);
      await desinstalar();
      await aplicar(definitiva, { pasta: op.pastaRede, execElevado });
    } catch (causa) {
      throw new ErroDepoisDoConvite(FALHA_TROCA, causa);
    }
    return { token: entrada.token };
  };
}
