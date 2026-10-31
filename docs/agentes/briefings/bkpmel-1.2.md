# Briefing bkpmel-1.2 — Colisões de nome além de maiúscula

BASE: 481eddaec29a64cc10c82c3e014e78f8710daad4 · RAMO: roadmap/bkpmel-1.2 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #88
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §integridade (manifesto e hash); §enxugar
TRIAGEM: M1 (+M7 mínimo para pasta/arquivo) | ~30 linhas de código + ~60 de teste | RISCO médio | MIÚDO: não | REAPROVEITAR: packages/nucleo/src/backup/manifesto.ts:139-167 (validarManifesto, bloco vistosMinusculos): trocar a.caminho.toLowerCase() (:157) por a.caminho.normalize("NFC").toLowerCase() e reusar o bloco para pasta/arquivo; recusaArquivo para a mensagem | NÃO ESCREVER: validação nova de caminho (caminhoSeguro ~:112) nem segunda passagem de nomes; gerarManifesto não muda | PASSOS: 1. NFC antes do toLowerCase; 2. Set de prefixos de pasta (NFC, minúsculo) e recusa quando um arquivo cai num prefixo de pasta ou o contrário, nas duas ordens; 3. mensagem pt-BR dizendo qual é a pasta; 4. testes em manifesto.test.ts ao lado de "recusa caminhos que colidem sem diferenciar maiúscula" (~:255) | PROVA: é em NFC+NFD recusado (falha antes); a + a/b recusado nas duas ordens; ab + a-b continua aceito | PARECIDO: bkpmel-1.1 (#29, ~70 est., ~90 real).

## Item (texto literal do roadmap)
- [ ] **1.2 — Colisões de nome além de maiúscula**
  *O que fazer:* normalizar Unicode (NFC) antes de comparar colisões (macOS trata `é` e `e`+acento como o mesmo nome);
  recusar arquivo `a` junto de pasta `a/b` no mesmo manifesto.
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com `é` nas duas formas e com `a` + `a/b` recusados.
  *Origem:* bkpmel-1.1 · PR #29 · qa

## Decisões que valem para este item
- Regra de ouro 2/3: o que viaja é pacote fechado com hash; o manifesto é a conferência de integridade.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkpmel-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/backup/manifesto.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #88) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo. Nada em services/cartorio, packages/nucleo/src/cartorio, packages/nucleo/src/servidor.

## O que NÃO decidir (perguntar à orquestradora)
nada
