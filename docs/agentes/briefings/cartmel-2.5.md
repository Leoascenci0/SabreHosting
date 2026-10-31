# Briefing cartmel-2.5 — Versão sem pacote não vira a mais nova

BASE: 07626345350607c80302a72f0f0bb4a9b403e388 · RAMO: roadmap/cartmel-2.5 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade §2
TRIAGEM: M4 (+M3), ~30 linhas código + ~70 teste, RISCO alto (cartório, regra 5). Reaproveitar maisNova (versoes.ts:57) como molde de maisNovaGuardada com AND EXISTS em copias_nuvem; armazem.ts:80-83 já usa copias_nuvem. NÃO alterar maisNova em si (armazem.ts usa para o envio de N: deadlock). Passos: 1) maisNovaGuardada em versoes.ts; 2) GET /versoes/mais-nova (servidor.ts ~524) usa a nova; 3) registrarVersao deixa de chamar informarCopia (o chamador informa depois de ter o mundo; confira quem chama no núcleo/cliente e ajuste o fluxo de importar para informar a cópia só após enviar o pacote); 4) teste: versão sem pacote não sai em /versoes/mais-nova; importador some de /copias até informar cópia; teste de envio do armazém continua verde.

## Item (texto literal do roadmap, em docs/roadmap-cart-melhoria.md, item 2.5)
- [ ] **2.5 — Versão sem pacote não pode virar a "mais nova"**
  *O que fazer:* hoje `POST /versoes` publica a versão N antes do envio do pacote; se o envio cair, `maisNova` aponta para N, ninguém tem N e a regra 5 (versão manda) trava os hosts até o dono importar de novo. Fazer `maisNova` ignorar versão sem pacote guardado (ou aceitar o pacote antes de publicar). Também: `registrarVersao` marca o PC importador como tendo a cópia N, mas o mundo local dele não mudou, então ele aparece como fonte do espalhar.
  *Arquivo:* `services/cartorio/src/versoes.ts`, `servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: versão criada sem pacote não é devolvida por `/versoes/mais-nova`; importador não aparece em `/copias` até ter a cópia.
  *Origem:* piloto-1.1c · PR #189 · qa integridade

## Decisões que valem para este item
cartmel-2.50

## Soluções conhecidas que se aplicam
S-01 (teste de tempo: folga/prazo explícito só no teste), S-06 (token de geração antes de qualquer await; agendador único), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume(); prazo de cabeçalho do Node corta em ~30 s), S-09 (hash completo), S-10 (PR de correção traz linhas "Regressão:" e "Tela no app:"), S-11 (no commit/PR, não escreva a flag que pula o pre-commit nem dentro de heredoc). Rodar vistorias uma de cada vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada além do que está nas decisões acima.
