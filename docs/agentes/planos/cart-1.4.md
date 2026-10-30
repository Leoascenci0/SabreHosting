# Plano cart-1.4 — Guardar a última cópia do mundo

Método: M1 (autorização de `versoes.ts`/`trava.ts`; padrão `.parcial` + `rename`) + M7 (`armazem.ts`). Risco alto:
é a cópia do mundo na nuvem. Pacote opaco (o cartório não abre o tar; quem baixa confere o manifesto). Sem delta por
região (fica para o sync-1.1/1.2). Sem importar `packages/nucleo`. Sem dependência nova.

Regras de ouro: 1 (só o dono da trava com a época atual envia), 3 (fluxo para `.parcial`, hash e tamanho conferidos,
`rename` atômico), 4 (rotação mantém as 3 mais novas e nunca a mais nova conferida), 5 (só a versão mais nova), 6
(pacotes de teste gerados em memória).

1. Testes primeiro (falham): `services/cartorio/src/armazem.test.ts` — queda no meio do fluxo → cópia anterior
   intacta e nenhum `.parcial`; hash errado e tamanho errado recusados; sem trava, época velha, trava vencida → recusa
   sem gravar nada; versão que não é a mais nova, ou registrada por outro PC → recusa; já guardada → recusa; acima do
   teto → recusa (antes e durante o fluxo); rotação mantém 3; 50 MB em fluxo sem crescer a memória (prazo explícito);
   rotas `PUT`/`GET /versoes/:n/pacote` (token, 404, bytes idênticos, cabeçalho `x-sabre-sha256`); conexão HTTP
   cortada no meio → nenhum parcial e a cópia anterior intacta.
2. Migração **v5**: tabela `copias_nuvem (versao PK → versoes, sha256, bytes, guardada_em)` com CHECKs (v1–v4 intactas;
   `versoes` não muda).
3. `armazem.ts`: `criarArmazem({banco, pasta, tetoBytes = 20 GiB, manter = 3})` limpa `.parcial` velhos;
   `receberPacote(armazem, versao, pc, epoca, agora, fluxo, {sha256, bytes})`: confere trava/versão/teto antes de
   gravar; fluxo → `mundo/v<N>.<aleatório>.parcial` com hash e contagem em fluxo (corta ao passar do declarado);
   confere; numa transação reconfere trava e versão, `rename` e registra; rotação apaga linhas além das 3 mais novas e,
   depois do commit, os arquivos. Erro em qualquer passo → apaga o parcial. `pacoteGuardado(armazem, n)` para o GET.
4. `servidor.ts`: rotas com `soPc`; corpo `application/octet-stream` passado como fluxo (sem carregar na memória);
   parâmetros (`epoca`, `sha256`, `bytes`) na query com esquema. `iniciar.ts` + `.env.exemplo`:
   `SABRE_CARTORIO_DADOS` (pasta) e `SABRE_CARTORIO_PACOTE_TETO_GIB`.
5. `npm run vistoria`; PR `Closes #53`.
