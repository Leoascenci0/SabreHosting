import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Argumentos do `node` para rodar o vigia sem build (o Node 22 tira os tipos; o gancho acha os imports .ts). */
export const ARGS_VIGIA_TESTE = [
  "--disable-warning=ExperimentalWarning",
  "--import",
  join(AQUI, "resolver-ts.mjs"),
  join(AQUI, "../../src/servidor/vigia.ts"),
];
