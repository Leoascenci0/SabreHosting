# Briefing lancmel-2.4

BASE: f6d674dc0c77d51b42a5eb7a5e40127e9113494c · RAMO: roadmap/lancmel-2.4 · MODELO: haiku
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references/seguranca.md e integridade.md (só o que o item toca); enxugar
TRIAGEM: M4; ui/configuracoes.ts carregarMods ~368-369 não limpa avisoMods/erroMods; ~8 linhas; baixo

## Item (texto literal do roadmap; arquivo docs/roadmap-lanc-melhoria.md, linhas 29,34p)
- [ ] **2.4 — Mods do grupo: limpar avisos antigos na tela**
  *O que fazer:* em `carregarMods` (`ui/configuracoes.ts`), `avisoMods` nunca é limpo quando o problema some e o `erroMods` de "Não consegui ler a lista…" fica depois de uma leitura bem-sucedida: limpar nos dois casos (sem apagar o erro de uma ação que acabou de falhar).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`
  **Tela no app:** Configurações › Grupo › "Mods do grupo".
  *Confirmação:* teste/e2e: aviso some quando a lista volta a carregar.
  *Origem:* lancmel-2.1 · PR #215 · qa

## Decisões que valem para este item
nenhuma. Não apagar o erro de uma ação (baixar/remover) que acabou de falhar.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR traz a linha `Regressão:` e `Tela no app:`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do descrito; dúvida = avisar a sessão de onda.
