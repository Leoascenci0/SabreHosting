# Briefing bkp-2.1 — Rotação segura de backups

BASE: 76ca4d2a7f870045c1ce3f8962aef81e70adcbb8 · RAMO: roadmap/bkp-2.1 · MODELO: sonnet (esforço alto; revisão de integridade em Opus) · ISSUE: #47
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §4 (rotação e restauração) e §6
TRIAGEM: M7 (plano puro + aplicação) · ~100 linhas (+~150 teste) · risco ALTO (apaga arquivos; regra de ouro 4) ·
MIÚDO: não. REAPROVEITAR: `abrirPacote`/`hashDoArquivo` para "conferido" (backup bom = hash do pacote confere e o
manifesto interno é válido); nome `<data>-v<versao>.tar.gz` do agendador (bkp-1.3). NÃO ESCREVER: dependência de
teste por propriedade (escreva um gerador pseudoaleatório com semente, sem lib nova); restauração (é bkp-2.2).
PASSOS: 1) `packages/nucleo/src/backup/rotacao.ts`: `planejarRotacao(backups, {recentes = 10, diarios = 7, agora})`
PURA → {manter, apagar}: mantém os N mais recentes + o mais recente de cada um dos últimos 7 dias + SEMPRE o backup
conferido mais recente (mesmo se fora das janelas) + qualquer backup ainda não conferido (não se apaga o que não se
sabe se é bom); nunca devolve "apagar" que deixe zero backups bons; 2) `aplicarRotacao(pasta, plano)`: confere de novo,
na hora, que ao menos um backup em "manter" está bom (hash) ANTES de apagar qualquer arquivo; apaga um por um, só
arquivos `.tar.gz` com o padrão de nome do SabreHosting dentro da pasta de backups (nunca segue link, nunca sai da
pasta); 3) `simular: true` (dry-run) devolve o plano sem apagar.
PROVA: testes de propriedade com semente (milhares de sequências aleatórias de backups, datas e estados "bom/ruim/não
conferido"): sempre sobra ≥ 1 bom; nunca apaga o último conferido; nunca apaga não conferido; janelas certas (10 + 7 dias
com fuso local); aplicar com o único bom corrompido entre o plano e a aplicação → não apaga nada; arquivo estranho na
pasta (outro nome, link) nunca apagado.

## Item (texto literal do roadmap)
- [ ] **2.1 — Rotação segura**
  *O que fazer:* manter os N mais recentes + 1 por dia dos últimos 7; nunca apagar o último conferido; dry-run nos testes.
  *Arquivo:* `packages/nucleo/src/backup/rotacao.ts`
  **Tela no app:** Configurações › Backups › Quantos guardar (padrão 10). D6 decidida (10 + 7 diários).
  *Confirmação:* testes de propriedade: em qualquer sequência, sobra ≥ 1 backup bom.
  *Depende de:* bkp-1.2

## Decisões que valem para este item
- D6: 10 mais recentes + 1 por dia dos últimos 7 ("Configurações › Backups › Quantos guardar", tela no app-2.2).
- Regra de ouro 4: nunca apagar o último backup bom.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkp-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); testes pesados com prazo explícito
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #47` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
