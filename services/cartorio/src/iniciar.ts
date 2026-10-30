import { abrirBanco } from "./banco.js";
import { conferirEndereco, criarCartorio } from "./servidor.js";

const env = process.env;
const endereco = conferirEndereco(env["SABRE_CARTORIO_ENDERECO"] ?? "127.0.0.1");
const app = criarCartorio({
  banco: abrirBanco(env["SABRE_CARTORIO_BANCO"] ?? "cartorio.db"),
  segredoAdmin: env["SABRE_CARTORIO_SEGREDO_ADMIN"] ?? "",
  trava: {
    prazoMs: Number(env["SABRE_CARTORIO_TRAVA_PRAZO_S"] || 60) * 1000,
    renovarMs: Number(env["SABRE_CARTORIO_TRAVA_RENOVAR_S"] || 20) * 1000,
  },
});
await app.listen({ host: endereco, port: Number(env["SABRE_CARTORIO_PORTA"] ?? 7710) });
