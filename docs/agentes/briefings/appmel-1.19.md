# Briefing appmel-1.19 — Reler `level-name` a cada operação

BASE: b3daf49751273e045968478d3212e875caa28e7d · RAMO: roadmap/appmel-1.19 · MODELO: sonnet (risco alto no domínio backup; sem gatilho Opus: não mexe em trava nem em packages/nucleo)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references/integridade.md (backup: regras de ouro 2 e 4); enxugar
TRIAGEM: M1 + M4 · ~60 linhas (~25 código + ~70 teste) · risco alto (decide qual pasta de mundo entra no backup). Reaproveitar config-pc.ts:43 `nomeDoMundo()` (já valida S-07), agenda-backups.ts:144-146 (`iniciarAgendaReal`, async, roda a cada servidor pronto), principal.ts (~:268, ~:472: `pc.pastaMundo` lido ao criar a agenda/backup). Passos: 1. trocar `pc.pastaMundo` por resolvedor que chama `nomeDoMundo(pc.pastaServidor)`; 2. resolver dentro de `iniciarAgendaReal` e em espalhar-versão/backupParado a CADA chamada; 3. teste: muda level-name entre dois Hospedar e o backup segue o novo. NÃO escrever: validação nova de level-name; mudança em packages/nucleo (agendador.ts recebe a string por agenda). Prova: teste que falha com a pasta antiga e passa com a nova; mundo inventado em tests/mundos.
**Decisão da Máxima (reversível):** a Confirmação "com o app aberto, o backup segue" só acontece entre dois Hospedar, porque o Minecraft lê `level-name` só ao subir. Prove assim. Nenhum backup com servidor rodando fora de save-off/save-all flush (regra 2) e nunca apagar o último backup bom (regra 4): não mexa nesses caminhos.

## Item (texto literal)
*O que fazer:* resolver `pastaMundo` na hora do backup/espalhar, e não só ao abrir o app (se o `level-name` mudar com o app aberto, o backup ainda aponta o mundo antigo).
*Arquivo:* `apps/desktop/src/main/config-pc.ts`, `principal.ts`
**Tela no app:** não se aplica.
*Confirmação:* teste: `level-name` muda com o app aberto e o backup segue o novo.

## Decisões que valem: nenhuma
## Critério de pronto
- [ ] Plano docs/agentes/planos/appmel-1.19.md primeiro commit
- [ ] Teste novo que falha antes e passa depois
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo + Triagem/Segurança/Integridade/Enxugamento/Roteamento + **Regressão:** + **Tela no app:** não se aplica
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem, mundo real, segredo, packages/nucleo.
## O que NÃO decidir: nada
