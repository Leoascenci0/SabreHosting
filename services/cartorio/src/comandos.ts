// Comandos de root na máquina da nuvem (cart-2.2 liga no instalador):
//   node comandos.js criar-convite-dono <nome-do-pc> [horas]
//   node comandos.js trocar-dono <id-do-pc>
//   node comandos.js trocar-dono --novo-convite <nome-do-pc> [horas]
import { pathToFileURL } from "node:url";
import type { AjudanteEntrada } from "./ajudante.js";
import { ajudanteDoAmbiente, caminhoBanco, grupoDoAmbiente } from "./ambiente.js";
import { type Banco, abrirBanco, donoAtual, emTransacao, nomeOcupado } from "./banco.js";
import {
  type Grupo,
  HORA_MS,
  NOME_PC,
  VALIDADE_MAXIMA_H,
  VALIDADE_PADRAO_H,
  emitirConvite,
} from "./convite.js";

/** Convite com a marca "dono". Sem `substituir`, recusa se já há dono ou convite de dono pendente. */
export async function criarConviteDono(
  banco: Banco,
  ajudante: AjudanteEntrada,
  grupo: Grupo,
  pedido: { nomePc: string; horas?: number; substituir?: boolean },
  agora: number,
): Promise<string> {
  const { nomePc, horas = VALIDADE_PADRAO_H, substituir = false } = pedido;
  if (!new RegExp(NOME_PC).test(nomePc))
    throw new Error("nome do PC inválido (letras minúsculas, números e hífen, até 32).");
  if (!Number.isInteger(horas) || horas < 1 || horas > VALIDADE_MAXIMA_H)
    throw new Error(`validade inválida (de 1 a ${VALIDADE_MAXIMA_H} horas).`);
  if (!substituir) {
    const dono = donoAtual(banco);
    if (dono) throw new Error(`o grupo já tem dono (${dono.nome}); use trocar-dono.`);
    const pendente = banco
      .prepare("SELECT 1 FROM convites WHERE para_dono = 1 AND usado_em IS NULL AND expira_em > ?")
      .get(agora);
    if (pendente) throw new Error("já existe um convite de dono pendente; use trocar-dono.");
  }
  if (nomeOcupado(banco, nomePc, agora)) throw new Error(`o nome ${nomePc} já está em uso.`);
  const r = await emitirConvite(
    banco,
    ajudante,
    grupo,
    { nomePc, validadeMs: horas * HORA_MS, paraDono: true },
    agora,
  );
  return r.convite;
}

/** Passa a marca de dono para outro PC ativo (com token válido). */
export function trocarDono(banco: Banco, pcId: number): string {
  return emTransacao(banco, () => {
    const pc = banco
      .prepare(
        `SELECT nome FROM pcs WHERE id = ?
           AND EXISTS (SELECT 1 FROM tokens WHERE pc_id = pcs.id AND revogado_em IS NULL)`,
      )
      .get(pcId) as { nome: string } | undefined;
    if (!pc) throw new Error(`não há PC ativo com o número ${pcId}.`);
    banco.prepare("UPDATE pcs SET dono = 0 WHERE dono = 1").run();
    banco.prepare("UPDATE pcs SET dono = 1 WHERE id = ?").run(pcId);
    return pc.nome;
  });
}

const USO =
  "uso: criar-convite-dono <nome-do-pc> [horas] | trocar-dono <id-do-pc> | trocar-dono --novo-convite <nome-do-pc> [horas]";

export async function rodarComando(
  args: readonly string[],
  env: Record<string, string | undefined>,
  agora = Date.now(),
): Promise<string> {
  const [comando, a, b, c] = args;
  const banco = abrirBanco(caminhoBanco(env));
  try {
    if (comando === "trocar-dono" && a && a !== "--novo-convite") {
      if (!/^\d+$/.test(a)) throw new Error(USO);
      return `Dono do grupo agora: ${trocarDono(banco, Number(a))}.`;
    }
    const novo = comando === "trocar-dono";
    const [nomePc, horas] = novo ? [b, c] : [a, b];
    if ((comando !== "criar-convite-dono" && !novo) || !nomePc) throw new Error(USO);
    const ajudante = ajudanteDoAmbiente(env);
    const grupo = grupoDoAmbiente(env);
    if (!ajudante)
      throw new Error("ajudante do WireGuard não instalado (socket SABRE_AJUDANTE_SOCKET).");
    if (!grupo)
      throw new Error(
        "dados do grupo ausentes (SABRE_GRUPO_NOME, SABRE_GRUPO_ENDERECO_JOGAR, SABRE_HUB_*).",
      );
    return await criarConviteDono(
      banco,
      ajudante,
      grupo,
      { nomePc, horas: horas === undefined ? undefined : Number(horas), substituir: novo },
      agora,
    );
  } finally {
    banco.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rodarComando(process.argv.slice(2), process.env).then(
    (saida) => console.log(saida),
    (erro: unknown) => {
      console.error(`ERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
      process.exitCode = 1;
    },
  );
}
