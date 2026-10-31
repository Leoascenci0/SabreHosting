# Briefing basemel-1.4 — Verificador barra marcador de conflito de merge

BASE: 96710a2254e2afc3e74fc24ba038355e257c28e1 · RAMO: roadmap/basemel-1.4 · MODELO: sonnet · ISSUE: #63
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; `scripts/verificar.py` inteiro (é curto); docs/memoria/solucoes.md S-02
TRIAGEM: M3 (molde das checagens que já existem no verificar.py) · ~30 linhas (+ teste) · risco baixo · MIÚDO: sim.
NÃO ESCREVER: reescrever o verificador; dependência nova. PASSOS: nova checagem em `scripts/verificar.py` que, para cada
arquivo de texto do diff (`--staged` e `--base`), procura um bloco de conflito: linha que começa com `<<<<<<< `, depois
uma linha exatamente `=======`, depois linha que começa com `>>>>>>> ` → REPROVADO com o arquivo e a linha; uma linha
`=======` isolada (sublinhado de título em Markdown) NÃO reprova; teste automatizado do verificador (se já houver teste
dele, siga o molde; senão, um teste Python simples rodado pela vistoria ou um teste Vitest que chama o script com
arquivos de exemplo em pasta temporária).
PROVA: arquivo com o trio → REPROVADO; título Markdown com `=======` → APROVADO; vistoria APROVADA.

## Item (texto literal do roadmap de melhoria)
- [ ] **1.4 — Verificador barra marcador de conflito de merge**
  *O que fazer:* `scripts/verificar.py` recusa arquivo com linha que começa com `<<<<<<< `, `=======` sozinho ou
  `>>>>>>> ` (em `--staged` e `--base`). Aconteceu na Onda 6: um commit de controle levou um conflito do
  `docs/ops/DECISOES.md` e o verificador aprovou.
  *Arquivo:* `scripts/verificar.py`
  **Tela no app:** não se aplica.
  *Confirmação:* commit de teste com marcador → REPROVADO; `.md` com `=======` como sublinhado de título não é falso positivo
  (exigir o trio ou a linha exata `=======` entre `<<<<<<<` e `>>>>>>>`).
  *Origem:* onda 6 · orquestradora

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.4.md como primeiro commit
- [ ] Teste novo (falha antes, passa depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com `Closes #63` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
