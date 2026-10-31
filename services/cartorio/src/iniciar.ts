import { join } from "node:path";
import {
  ajudanteDoAmbiente,
  caminhoBanco,
  grupoDoAmbiente,
  pastaDados,
  portaCartorio,
} from "./ambiente.js";
import { abrirBanco, apagarConvitesVencidos } from "./banco.js";
import { conferirEndereco, criarCartorio } from "./servidor.js";

const env = process.env;
const endereco = conferirEndereco(env["SABRE_CARTORIO_ENDERECO"] ?? "127.0.0.1");
// Fora do diretório atual: a unidade do systemd só deixa gravar em /var/lib/sabre.
const dados = pastaDados(env);
const banco = abrirBanco(caminhoBanco(env));
apagarConvitesVencidos(banco, Date.now());
const app = criarCartorio({
  banco,
  ajudante: ajudanteDoAmbiente(env),
  grupo: grupoDoAmbiente(env),
  armazem: {
    pasta: join(dados, "mundo"),
    tetoBytes: Number(env["SABRE_CARTORIO_PACOTE_TETO_GIB"] || 20) * 1024 ** 3,
  },
  trava: {
    prazoMs: Number(env["SABRE_CARTORIO_TRAVA_PRAZO_S"] || 60) * 1000,
    renovarMs: Number(env["SABRE_CARTORIO_TRAVA_RENOVAR_S"] || 20) * 1000,
  },
});
await app.listen({ host: endereco, port: portaCartorio(env) });
