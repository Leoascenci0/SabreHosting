import { join } from "node:path";
import { abrirBanco, apagarConvitesVencidos } from "./banco.js";
import { conferirEndereco, criarCartorio } from "./servidor.js";

const env = process.env;
const endereco = conferirEndereco(env["SABRE_CARTORIO_ENDERECO"] ?? "127.0.0.1");
// Fora do diretório atual: a unidade do systemd só deixa gravar em /var/lib/sabre.
const dados = env["SABRE_CARTORIO_DADOS"] || "/var/lib/sabre/cartorio";
const banco = abrirBanco(env["SABRE_CARTORIO_BANCO"] || join(dados, "cartorio.db"));
apagarConvitesVencidos(banco, Date.now());
const app = criarCartorio({
  banco,
  segredoAdmin: env["SABRE_CARTORIO_SEGREDO_ADMIN"] ?? "",
  armazem: {
    pasta: join(dados, "mundo"),
    tetoBytes: Number(env["SABRE_CARTORIO_PACOTE_TETO_GIB"] || 20) * 1024 ** 3,
  },
  trava: {
    prazoMs: Number(env["SABRE_CARTORIO_TRAVA_PRAZO_S"] || 60) * 1000,
    renovarMs: Number(env["SABRE_CARTORIO_TRAVA_RENOVAR_S"] || 20) * 1000,
  },
});
await app.listen({ host: endereco, port: Number(env["SABRE_CARTORIO_PORTA"] ?? 7710) });
