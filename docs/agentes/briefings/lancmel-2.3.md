# Briefing lancmel-2.3

BASE: f6d674dc0c77d51b42a5eb7a5e40127e9113494c · RAMO: roadmap/lancmel-2.3 · MODELO: sonnet (risco alto, sem gatilho Opus)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references/seguranca.md e integridade.md (só o que o item toca); enxugar
TRIAGEM: M4+M1; baixar.ts baixarConferido linha ~121 apaga destino antes de baixar, buscar() segue redirect sem checar host; mods.ts repassa; ~25 linhas; risco ALTO (rede); hostsPermitidos não existe

## Item (texto literal do roadmap; arquivo docs/roadmap-lanc-melhoria.md, linhas 22,27p)
- [ ] **2.3 — Download de mod: recusar redirecionamento para outro host e não apagar o mod antes de baixar o novo**
  *O que fazer:* `baixarConferido` ganha opção `hostsPermitidos` (usada por `mods.ts`) e recusa redirect para host fora da lista; o arquivo local de mesmo nome só sai depois do novo estar conferido. Teste de redirect.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.ts`, `packages/nucleo/src/launcher/mods.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: redirect para outro host recusado; falha no download mantém o mod antigo.
  *Origem:* lanc-1.4 · PR #210 · qa

## Decisões que valem para este item
nenhuma. Redirect para host fora da lista recusado também em redirect encadeado; baixar para temporário e só renomear sobre o antigo depois do hash conferido.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR traz a linha `Regressão:` e `Tela no app:`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do descrito; dúvida = avisar a sessão de onda.
