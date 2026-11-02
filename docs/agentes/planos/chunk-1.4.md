# Plano chunk-1.4 — Nova versão do mundo e "Desfazer" (triagem M1+M3+M7)

Base 24df006. Núcleo em `packages/nucleo/src/mundo/versao-reset.ts`; ligação em `apps/desktop/src/main/mundo-versao.ts`
(+ um gancho pequeno em `deps-backups.ts`). Sem tela, sem rota nova no cartório, sem dependência nova.

## Decisões (do briefing)
- Versão só vale com pacote enviado: publicar = `criarPacote` (servidor parado, trava) + `criarVersao` + `enviarPacote`,
  molde `importar.ts`. O pacote fica na pasta de backups (assim a versão local do PC já é N+1 e o espalhar não baixa nada).
- Desfazer = `restaurarBackup` do último `antes-de-resetar` (já faz o backup do atual) + publicar N+1 (conteúdo antigo,
  versão nunca volta). Tudo sob UMA vez (trava) no main.
- `jogadoDepois` (backup posterior além do pacote do reset, ou versão do cartório mais nova): exige `confirmado: true`;
  sem ele devolve o plano e não escreve. Já desfeito (backup `antes-de-restaurar` posterior) ou sem reset: recusa.
- Cartório fora: grava `versao-pendente.json` (caminho do pacote + hashes + versão) ao lado do mundo ANTES de registrar;
  `podeSubir` bloqueia Hospedar com texto fixo; `retomarVersaoPendente` decide pelo cartório (ultimoRegistrado = v-1 → registra;
  = v → só envia; maisNova = v → só apaga o marcador; outro → recusa) e por isso nunca registra duas vezes.
- Marcador é entrada não confiável (S-07): caminho tem de ser filho direto da pasta de backups, nome `*.tar.gz`, hash confere.

## Testes (primeiro, vermelhos)
1. versão sobe UMA vez por reset e por desfazer (cartório falso conta chamadas).
2. desfazer devolve o mundo byte a byte (`hashesDoMundo`); backup do atual feito antes.
3. sem cartório: reset fica local, grava marcador, aviso "versão ainda não espalhada"; podeSubir bloqueia.
4. retomada publica o pendente uma vez e apaga o marcador; retomada após registro órfão só envia.
5. marcador adulterado (caminho fora, hash errado, JSON torto) não publica nem apaga nada.
6. desfazer: sem reset recusa; já desfeito recusa; servidor rodando / sem trava recusa; `jogadoDepois` sem confirmar não escreve.
7. mensagens fixas, sem caminho cru.

Fora do escopo (vai para o PR): bloqueio de início do servidor/backup manual durante o reset (1.5); ações `mundo:*` (1.5).
