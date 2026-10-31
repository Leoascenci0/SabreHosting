# Briefing cartmel-1.6 — Tipo da época garantido no banco e recusa mais clara na passagem

BASE: 2c927d8e3ca8bfe82ac4e0a28dcd91eab14f4444 · RAMO: roadmap/cartmel-1.6 · MODELO: opus (gatilho: lógica de trava + migração da linha da trava)
ISSUE: #125
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; §integridade (trava); §seguranca (cartório); docs/memoria/metodos-aprendidos.md (L-01)
TRIAGEM: M3 (+M4) | ~45 linhas + ~80 de teste | RISCO alto | MIÚDO: não | REAPROVEITAR: gatilho trava_epoca_nunca_desce (services/cartorio/src/banco.ts, migração 2) como molde; mudar/recusaDoDono (services/cartorio/src/trava.ts:~57-90, destino_invalido ~88); RECUSA_TRAVA (servidor.ts:~86-93) | NÃO ESCREVER: tabela nova ou rebuild da trava (arrisca zerar a época e abrir dois hosts); CAST na migração; editar migrações antigas | CAMINHO: migração nova no FIM de MIGRACOES com `CREATE TRIGGER ... BEFORE UPDATE OF epoca ON trava WHEN typeof(NEW.epoca) <> 'integer' BEGIN SELECT RAISE(ABORT, ...); END` (e o mesmo para INSERT se a linha puder ser inserida); dados existentes não são reescritos | PASSOS: 1. migração com o gatilho; 2. trava.ts: destino_sem_acesso quando o PC existe mas não tem token ativo (consulta o banco); 3. MotivoRecusa + RECUSA_TRAVA com mensagem pt-BR; 4. packages/nucleo/src/cartorio/tipos.ts: +1 motivo no contrato à mão (o cartmel-2.1, já na main, valida os motivos — confira que o validador aceita o novo); 5. trava.test.ts:184-188 hoje espera destino_desconhecido para PC sem token: trocar a expectativa e dizer no PR | PROVA: UPDATE com texto falha; passar para PC com token revogado → destino_sem_acesso; migrar banco na versão anterior preserva a época (teste); vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.6 — Tipo da época garantido no banco e recusa mais clara na passagem**
  *O que fazer:* numa migração nova, `CHECK (typeof(epoca) = 'integer')` na trava (hoje um UPDATE com texto passaria
  pelo gatilho; não se alcança pela API); recusa própria `destino_sem_acesso` quando o destino só tem token revogado.
  *Arquivo:* `services/cartorio/src/banco.ts`, `services/cartorio/src/trava.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* `UPDATE trava SET epoca='abc'` falha; passar para PC revogado devolve `destino_sem_acesso`.
  *Origem:* cartmel-1.5 · PR #27 · qa

## Decisões que valem para este item
- Decidido pela Máxima (reversível): PC sem nenhum token ativo → destino_sem_acesso (não destino_desconhecido); PC que não existe → destino_desconhecido como hoje.
- Regra de ouro 1: a época só sobe; nada nesta migração pode reescrever a linha da trava.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.6.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio/src/ (e nucleo/cartorio se o validador mudar)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #125) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada
