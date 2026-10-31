// O parser do app lê exatamente o texto que o cartório emite (app-1.3a). Banco em memória, ajudante falso, sem rede.
import { describe, expect, it } from "vitest";
import { lerConvite } from "../../packages/nucleo/src/rede/convite.js";
import { gerarParProvisorio, type AjudanteEntrada } from "../../services/cartorio/src/ajudante.js";
import { abrirBanco } from "../../services/cartorio/src/banco.js";
import { emitirConvite, type Grupo } from "../../services/cartorio/src/convite.js";

const HORA = 3_600_000;
const GRUPO: Grupo = {
  nome: "Grupo de Teste",
  enderecoJogar: "jogar.exemplo",
  hubEndpoint: "hub.exemplo:51820",
  hubChavePub: gerarParProvisorio().publica,
  portaCartorio: 7710,
};
const ajudante: AjudanteEntrada = {
  adicionar: () => Promise.resolve("10.66.0.200"),
  trocar: () => Promise.reject(new Error("não usado")),
  remover: () => Promise.resolve(),
};

describe("convite emitido pelo cartório × parser do app", () => {
  it("lê o texto de emitirConvite e devolve os dados do grupo", async () => {
    const agora = Date.now();
    const banco = abrirBanco(":memory:");
    const { convite, expiraEm } = await emitirConvite(
      banco,
      ajudante,
      GRUPO,
      { nomePc: "pc-do-lucas", validadeMs: 24 * HORA },
      agora,
    );
    const r = lerConvite(convite, agora);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.convite).toMatchObject({
      grupo: "Grupo de Teste",
      hub: "hub.exemplo:51820",
      chavePublicaHub: GRUPO.hubChavePub,
      ipProvisorio: "10.66.0.200",
      portaCartorio: 7710,
      venceEm: Math.floor(expiraEm / 1000) * 1000,
    });
    expect(lerConvite(convite, expiraEm + 1000)).toMatchObject({ ok: false, motivo: "vencido" });
  });
});
