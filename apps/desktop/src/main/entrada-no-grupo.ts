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

/**
 * Passo elevado da entrada no grupo (spec §5.2, item 3): instala a conexão provisória com a chave do convite, usa o
 * convite no cartório (só alcançável por ela), troca pela conexão definitiva com a chave própria e devolve o token.
 * Se o cartório recusar, o token nunca existe e a chave própria nunca é instalada. Nada vai para log nem para erro.
 *
 * LIMITE (prova real é [P]): cada instalar/desinstalar do WireGuard pede o administrador do Windows; fundir tudo num
 * único pedido fica como melhoria.
 */
export function criarEntradaNoGrupo(op: OpcoesEntrada) {
  const aplicar = op.aplicar ?? aplicarNoWindows;
  const execElevado = op.execElevado ?? criarExecutorElevado();
  return async function entrar(convite: Convite, chaves: ParDeChaves): Promise<{ token: string }> {
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
    const { token, pacote } = await cliente.usarConvite(convite.codigo, chaves.publica);
    const definitiva = montarConfigDoPc(pacote, chaves.privada);
    try {
      await execElevado(WIREGUARD_EXE, ["/uninstalltunnelservice", NOME_DO_TUNEL]);
    } catch (causa) {
      throw new Error(
        "Entrei no grupo, mas não consegui trocar a conexão privada. Abra o SabreHosting de novo ou peça um convite novo.",
        { cause: causa },
      );
    }
    await aplicar(definitiva, { pasta: op.pastaRede, execElevado });
    return { token };
  };
}
