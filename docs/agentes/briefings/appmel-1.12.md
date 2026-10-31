# Briefing appmel-1.12

BASE: f6d674dc0c77d51b42a5eb7a5e40127e9113494c · RAMO: roadmap/appmel-1.12 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references/seguranca.md e integridade.md (só o que o item toca); enxugar
TRIAGEM: M4; main/cofre.ts ler() devolve undefined no catch e quando isEncryptionAvailable é falso; consumidores config-pc.ts:44 e boas-vindas.ts; ~30 linhas; risco ALTO (segredo)

## Item (texto literal do roadmap; arquivo docs/roadmap-app-melhoria.md, linhas 101,107p)
- [ ] **1.12 — Cofre: distinguir "não existe" de "corrompido"**
  *O que fazer:* `ler()` do cofre devolve `undefined` também quando o decrypt falha; devolver estado distinto para o assistente pedir novo convite em vez de achar que é a primeira vez.
  *Arquivo:* `apps/desktop/src/main/cofre.ts`
  **Tela no app:** não se aplica (mensagem no assistente do app-1.3b).
  *Confirmação:* teste com arquivo adulterado.
  *Origem:* app-1.3a · PR #207 · qa

## Decisões que valem para este item
nenhuma. Contrato novo ausente/corrompido; ajuste os consumidores com o mínimo (config-pc.ts só no ponto do cofre: outra filha mexerá em config-pc.ts depois).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.12.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); PR traz a linha `Regressão:` e `Tela no app:`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do descrito; dúvida = avisar a sessão de onda.
