# Plano appmel-1.13 — "Pasta do SabreHosting" e um só pedido de administrador

Triagem: M2 (campo) + M1 (reaproveita `pastaPermitida`, `lerSalvo`, `configuracoes.escolherPasta`) + M3 (fundir pedidos).

## O que já existe (grep)
- `boas-vindas.ts`: `pastaPermitida`, `lerSalvo`/`gravarSalvo` (troca atômica). `config-pc.ts` já deriva servidor/mundo/backups de `pastaBase`.
- `entrada-no-grupo.ts`: 3 chamadas ao executor elevado (instala provisória, desinstala, instala definitiva) = 3 UAC.
- `criarExecutorElevado` (nucleo/rede/wireguard.ts): prazo fixo de 60 s.

## A) Pasta do SabreHosting (Configurações › Geral)
1. `main/pasta-base.ts`: `estado()` (pasta atual, ou ausente) e `trocar(pasta)`:
   - recusa pasta torta (`pastaPermitida`), assistente não concluído, e **servidor rodando** (mensagem fixa);
   - pasta igual à atual: "já é essa", nada muda;
   - cria só `servidor/` e `mundos/` na nova, copia o `eula.txt` já aceito (arquivo pequeno), grava `boas-vindas.json` de forma atômica;
   - **nunca move, copia nem apaga o mundo/backups antigos**: devolve a pasta antiga para a tela avisar onde ficaram;
   - erro vira mensagem fixa (S-14); a pasta gravada é revalidada ao ler (S-07, já feito em `lerConfigPc`).
2. Ponte `sabre:pasta:estado` / `sabre:pasta:trocar` (a escolha usa o seletor que já existe, `sabre:config:escolher-pasta`; o main revalida o caminho). Depois de trocar o app reinicia (mesma saída de `aoConcluir`; não no E2E).
3. Tela: campo só de leitura + "Trocar pasta…" + confirmação ("o mundo atual NÃO é movido; fica em …; o app reinicia").

## B) Um só pedido de administrador
Hoje: provisória → usar convite (precisa do túnel) → desinstala → definitiva. Para ficar em **uma** chamada elevada, o
script elevado (texto fixo, `-EncodedCommand`; dados em JSON base64, nunca colados no texto) faz tudo e combina com o app por
arquivos na pasta protegida da rede:
`instalada.flag` (script→app) · `troca.go` com `sabre.conf` definitivo gravado (app→script) · `cancelar.flag` (app→script).
- Script: instala `sabre.conf` provisório e apaga; sinaliza; espera `troca.go` ou `cancelar.flag` (prazo); se troca: desinstala + instala definitivo + apaga a conf; se cancelar: desinstala.
- App: protege a pasta (extraído de `aplicarNoWindows` para `protegerPastaDaRede`), grava a provisória, dispara o executor (UM `execElevado`), espera `instalada.flag` (corre contra a falha do executor), usa o convite, guarda o token ANTES de gravar a definitiva, sinaliza.
- `criarExecutorElevado` ganha prazo opcional (padrão 60 s; aqui 5 min, porque inclui o UAC e a ida ao cartório).
- Mantém: token no cofre antes da troca; `ErroDepoisDoConvite`; recusa do cartório não instala a chave própria.

## Testes (TDD)
pasta-base: troca atualiza `lerConfigPc` (servidor, mundo, backups), servidor rodando recusa, pasta torta recusa, mundo antigo intacto, eula copiado, igual = no-op, falha de disco = mensagem fixa.
entrada: `execElevado` chamado 1 vez; ordem dos passos; cartório recusa → cancela e chave própria nunca instalada; falha na troca → `ErroDepoisDoConvite`; script sem segredo/caminho cru.

## [P] Só num Windows de verdade: o UAC aparece 1 vez, o script elevado instala/desinstala o túnel.
