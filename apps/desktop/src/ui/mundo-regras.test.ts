import { describe, expect, it } from "vitest";
import {
  areaDosCampos,
  camposDasRegioes,
  confirmaNome,
  situacaoDaTela,
  textoDaPublicacao,
  textoDoPlano,
  textoPendencia,
} from "./mundo-regras.js";
import type { PlanoDoResetDaTela } from "./ponte.js";

const plano = (sobre: Partial<PlanoDoResetDaTela> = {}): PlanoDoResetDaTela => ({
  dimensao: "overworld",
  chunksNaArea: 64,
  chunksExistentes: 64,
  regioesTocadas: 1,
  regioesApagadasInteiras: 0,
  bytesLiberados: 0,
  setoresReaproveitaveis: 0,
  avisos: [],
  ...sobre,
});

describe("área vinda dos campos (blocos → chunks)", () => {
  it("retângulo: cada canto vira o chunk que o contém, também no negativo", () => {
    expect(
      areaDosCampos("retangulo", { x1: "0", z1: "-1", x2: "31", z2: "16", x: "", z: "", raio: "" }),
    ).toEqual({ ok: true, area: { tipo: "retangulo", x1: 0, z1: -1, x2: 1, z2: 1 } });
    expect(
      areaDosCampos("retangulo", {
        x1: "-16",
        z1: "-17",
        x2: "-1",
        z2: "0",
        x: "",
        z: "",
        raio: "",
      }),
    ).toEqual({ ok: true, area: { tipo: "retangulo", x1: -1, z1: -2, x2: -1, z2: 0 } });
  });

  it("raio: ponto e raio em blocos, sem converter", () => {
    expect(
      areaDosCampos("raio", { x1: "", z1: "", x2: "", z2: "", x: "100", z: "-50", raio: "200" }),
    ).toEqual({ ok: true, area: { tipo: "raio", x: 100, z: -50, raio: 200 } });
  });

  it("campo vazio, com vírgula, letra ou fora do limite vira mensagem em português", () => {
    const vazio = { x1: "", z1: "", x2: "", z2: "", x: "", z: "", raio: "" };
    for (const ruim of ["", " ", "1,5", "abc", "1e3", "99999999999"]) {
      const r = areaDosCampos("raio", { ...vazio, x: ruim, z: "0", raio: "10" });
      expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("número inteiro") });
    }
    expect(areaDosCampos("raio", { ...vazio, x: "0", z: "0", raio: "0" })).toMatchObject({
      ok: false,
      mensagem: expect.stringContaining("raio"),
    });
  });
});

describe("grade de regiões → campos", () => {
  it("uma região cobre 512 x 512 blocos; várias viram o retângulo que as contém", () => {
    expect(camposDasRegioes([{ x: 0, z: 0 }])).toEqual({ x1: "0", z1: "0", x2: "511", z2: "511" });
    expect(
      camposDasRegioes([
        { x: -1, z: 0 },
        { x: 1, z: 2 },
      ]),
    ).toEqual({ x1: "-512", z1: "0", x2: "1023", z2: "1535" });
  });

  it("os campos de uma região resultam nos 1024 chunks dela", () => {
    const c = camposDasRegioes([{ x: -1, z: 1 }]);
    expect(areaDosCampos("retangulo", { ...c, x: "", z: "", raio: "" })).toEqual({
      ok: true,
      area: { tipo: "retangulo", x1: -32, z1: 32, x2: -1, z2: 63 },
    });
  });
});

describe("prévia em palavras (sempre com a comparação)", () => {
  it("diz quantos chunks, quanto libera e de quanto, e que o backup vem antes", () => {
    const t = textoDoPlano(
      plano({ chunksExistentes: 64, bytesLiberados: 0, setoresReaproveitaveis: 1024 }),
      2.2 * 1024 ** 3,
    );
    expect(t.titulo).toBe("Vai apagar 64 chunks.");
    expect(t.linhas.join(" ")).toContain("cerca de 4 MB de 2,2 GB no mundo todo");
    expect(t.linhas.join(" ")).toContain("só diminui quando a região inteira");
    expect(t.linhas.at(-1)).toBe("Um backup é feito antes.");
  });

  it("região que sai inteira libera o arquivo de vez; singular e sem total conhecido", () => {
    const t = textoDoPlano(
      plano({ chunksExistentes: 1, regioesApagadasInteiras: 1, bytesLiberados: 8192 }),
      undefined,
    );
    expect(t.titulo).toBe("Vai apagar 1 chunk.");
    expect(t.linhas.join(" ")).toContain("8 KB");
    expect(t.linhas.join(" ")).toContain("tamanho do mundo todo não está disponível");
    expect(t.linhas.join(" ")).not.toContain("só diminui");
  });

  it("nada existe na área: avisa e não promete backup", () => {
    const t = textoDoPlano(plano({ chunksExistentes: 0 }), 1024 ** 3);
    expect(t.titulo).toBe("Não existe nenhum chunk nessa área.");
    expect(t.podeResetar).toBe(false);
    expect(t.linhas.join(" ")).not.toContain("backup");
  });
});

describe("confirmação digitando o nome do mundo", () => {
  it("só o nome exato vale (espaço nas pontas não conta; caixa conta)", () => {
    expect(confirmaNome("world", "world")).toBe(true);
    expect(confirmaNome("  world ", "world")).toBe(true);
    expect(confirmaNome("World", "world")).toBe(false);
    expect(confirmaNome("", "")).toBe(false);
    expect(confirmaNome("", "world")).toBe(false);
  });
});

describe("o que a tela mostra para cada situação", () => {
  it("não é dono: sem controles; carregando; demonstração mostra os controles", () => {
    expect(situacaoDaTela(undefined).visao).toBe("carregando");
    expect(situacaoDaTela({ dono: false }).visao).toBe("so-dono");
    expect(situacaoDaTela({ dono: false, demonstracao: true })).toMatchObject({
      visao: "controles",
      demonstracao: true,
    });
  });

  it("servidor ligado desliga as ações com a dica fixa; pendência explica", () => {
    const base = { dono: true as const, nome: "world", servidorLigado: false };
    expect(situacaoDaTela({ ...base, pendencia: "nenhuma" })).toMatchObject({
      visao: "controles",
      motivoDesligado: undefined,
    });
    expect(situacaoDaTela({ ...base, servidorLigado: true, pendencia: "nenhuma" })).toMatchObject({
      motivoDesligado: "Pare o servidor para resetar",
    });
    expect(situacaoDaTela({ ...base, pendencia: "aguardando" }).motivoDesligado).toContain(
      "reset anterior",
    );
    expect(situacaoDaTela({ ...base, pendencia: "conflito" }).motivoDesligado).toContain(
      "reset anterior",
    );
  });
});

describe("textos de pendência e de resultado (sem termo técnico)", () => {
  it("pendência diz o que fazer; conflito diz que nada é apagado", () => {
    expect(textoPendencia("aguardando")).toContain("Hospedar");
    const c = textoPendencia("conflito");
    expect(c).toContain("divergiram");
    expect(c).toContain("Nada é apagado");
    for (const t of [textoPendencia("aguardando"), c])
      expect(t).not.toMatch(/marcador|época|hash|epoca|trava/i);
  });

  it("resultado: enviado, pendente e conflito", () => {
    expect(textoDaPublicacao({ estado: "publicada", versao: 8 }, 64)).toContain("versão 8");
    expect(
      textoDaPublicacao({ estado: "pendente", versao: 8, aviso: "Sem resposta do cartório." }, 64),
    ).toContain("Sem resposta do cartório.");
    expect(textoDaPublicacao({ estado: "conflito", versao: 8, aviso: "x" }, 64)).toContain(
      "divergiram",
    );
  });
});
