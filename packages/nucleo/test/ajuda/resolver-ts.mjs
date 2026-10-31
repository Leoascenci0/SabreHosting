// Só testes: deixa o `node` rodar um .ts do núcleo direto (o Node 22 tira os tipos), resolvendo os imports
// `./x.js` para `./x.ts` quando o .js não existe (os testes rodam sem build).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(especificador, contexto, proximo) {
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    if (!especificador.endsWith(".js") || !contexto.parentURL?.endsWith(".ts")) throw erro;
    return proximo(especificador.slice(0, -3) + ".ts", contexto);
  }
}`),
);
