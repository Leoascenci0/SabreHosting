# Plano lancmel-2.4 — Mods do grupo: limpar avisos antigos na tela

**Item:** Configurações › Grupo › "Mods do grupo". `avisoMods` nunca é limpo quando o problema some, e o `erroMods`
"Não consegui ler a lista…" fica depois de uma leitura bem-sucedida.

## Triagem
M4 (~8 linhas, baixo risco): mudar só `carregarMods` em `apps/desktop/src/ui/configuracoes.ts`, com um parâmetro
`preservarMensagens`. Sem arquivo novo, sem dependência.

## Regra de comportamento
- Leitura "de tela" (abrir Configurações, `carregar()`): limpa `avisoMods` e `erroMods` e depois mostra o que o
  estado do cartório trouxer (`e.erro`, `e.aviso`).
- Leitura que vem de uma ação (adicionar/tirar, `finally`) e a do temporizador de "atualizando" (`setTimeout`):
  `preservarMensagens = true`. Não apaga o erro nem o aviso da ação que acabou de rodar; só põe o que o estado trouxer.

## Passos (TDD)
1. E2E `apps/desktop/e2e/configuracoes.e2e.ts`: teste novo que falha antes da correção.
   - Aviso: com a sincronia falhando, adicionar um mod mostra o aviso; sem a falha, voltar e reabrir Configurações
     faz o aviso sumir.
   - Erro de leitura: com a leitura da lista falhando, reabrir mostra o erro; sem a falha, reabrir limpa o erro.
   - Erro de ação continua visível depois da atualização que vem do `finally`.
2. Fake de E2E (`apps/desktop/src/main/fake-e2e.ts`): dois interruptores em `__sabreE2EMods` (`falhaSincronia`,
   `falhaLer`) que o teste liga e desliga. Só o E2E usa; nada muda para o app real.
3. Correção em `carregarMods` e nos dois `.finally` / `setTimeout` que chamam `carregarMods`.
4. `npm run vistoria` (ou o que o ambiente da sessão permitir; o que não rodar fica em "O que NÃO foi confirmado").
5. PR com `Regressão:`, `Tela no app:`, `Triagem:`, `Segurança:`, `Integridade:`, `Enxugamento:`, `Roteamento:`.

## Riscos
- O E2E depende do Electron rodar nesta sessão; se não rodar, o teste novo é verificado só por leitura e o PR diz isso.
- Não mexe em `mods-grupo.ts` (regra do servidor já limpa o aviso a cada rodada).
