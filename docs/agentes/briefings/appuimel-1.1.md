# Briefing appuimel-1.1 — Backup manual e origem do backup

BASE: efc71b78d4520cd68195ca4926ae4b0fbdad0ea2 · RAMO: roadmap/appuimel-1.1 · MODELO: sonnet (risco alto: backup/rotação; sem gatilho Opus)
SKILLS: using-superpowers, qualidade-sabre (parte `integridade`: toca backup/mundo), impeccable (toca a tela Backups)
LEIA: qualidade-sabre §1, integridade §2 (rotação e manifesto), interface, enxugar

TRIAGEM: M1+M3 (M4 para o e2e.mjs), ~190 linhas (+~150 teste), risco alto (manual dispara a rotação). REAPROVEITAR: `fazerBackup` em packages/nucleo/src/backup/agendador.ts:37 (a tela chama este; não duplicar); rotação via `aoBackupBom` em apps/desktop/src/main/principal.ts:286; criarBackups/estado/restaurar em apps/desktop/src/main/backups.ts:31 (molde do novo `fazer`); listarBackups em listar.ts; `criarAgendaBackups` já expõe estado "pronto" (agenda-backups.ts:29); botão+progresso+confirmação da restauração em apps/desktop/src/ui/backups.ts. NÃO ESCREVER: segundo caminho de backup (nada de criarPacote direto no botão); nova rotação; validação de origem em duas camadas; parser de origem separado do validarManifesto; nova trava de restauração (já existe `restaurando`). PASSOS: 1) manifesto.ts: campo `origem`; `validarManifesto` MONTA objeto novo e descarta extras, então tem que copiar `origem` normalizada (ausente/torta = 'automatico'); gerarManifesto recebe origem. 2) pacote.ts/agendador.ts: OpcoesBackup ganha `origem` (agendador = 'automatico'); restaurar.ts:~101 grava 'antes-de-restaurar'. 3) listar.ts: BackupListado ganha `origem`. 4) backups.ts: `fazer()` com recusas (servidor não pronto, backup/restauração em curso, demonstração) + ponte (preload.cts, ponte.ts) + IPC em principal.ts; estado devolve `prontoParaBackup`. 5) ui/backups.ts: botão, carregando, resultado fixo. 6) lista mostra origem em palavras. 7) e2e.mjs repassa process.argv.slice(2) ao vitest. ATENÇÃO: verificar se algum teste fixa o JSON exato do manifesto (o hash do manifesto muda com o campo novo; afeta sync/cartório só para backups novos); backup antigo sem `origem` deve continuar válido e com o mesmo hash.

## Item (texto literal do roadmap)
Ver `docs/roadmap-appui-melhoria.md` item 1.1 (no ramo `roadmap/onda-2026-11-02-43`), e a decisão do Eliel de 01/11/2026 em `docs/ops/DECISOES.md`.
Resumo: (1) campo `origem` (`automatico`|`manual`|`antes-de-restaurar`) no manifesto, ausente/torto = automatico, sem migração; (2) botão "Fazer backup agora" só habilitado com servidor pronto (estado vem do main), pelo MESMO `fazerBackup` (save-off + save-all flush + save-on, regra de ouro 2); recusa no main sem servidor pronto / backup ou restauração em andamento / demonstração, com mensagem clara em pt-BR; estado carregando; resultado "Backup feito" ou erro em texto fixo seguro, sem caminho cru (ficha S-14); (3) lista com "Automático", "Manual", "Antes de restaurar" (mantendo "Este PC" quando útil); (4) o manual conta na rotação e NUNCA derruba o mínimo garantido (regra de ouro 4).
**Tela no app:** Backups › "Fazer backup agora"; linha da lista com a origem.

## Decisões que valem
Linha de 2026-11-01 "Backup manual e origem do backup" e a de rotação 10 + 7 dias (appmel-1.11) em DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-1.1.md como primeiro commit
- [ ] Testes que FALHAM antes e passam depois: manifesto (origem gravada/lida, ausente=automatico, torta=automatico, sobrevive a validarManifesto); backups.ts do main (recusa sem servidor pronto, com backup em andamento, em restauração e em demonstração; chama fazerBackup com save-off/flush uma vez); rotação (manual não derruba o mínimo garantido); e2e da tela (botão desabilitado sem servidor, habilitado com servidor pronto, linha nova "Manual"); filtro do e2e.mjs. Mundo de teste inventado (`tests/mundos/`)
- [ ] `npm run vistoria` APROVADA (e `npm run vistoria:comum`); e2e rodado (`npm run build` antes, S-20)
- [ ] PR com as seções do modelo, linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, `Regressão:` e `Tela no app:` (S-10); registrar "Não confirmado": Windows real e servidor Minecraft real (só o fake de teste)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Não mexer em docs/ops/bom-dia.md nem custos.md.

## O que NÃO decidir
Nada (decisão já tomada pelo Eliel).
