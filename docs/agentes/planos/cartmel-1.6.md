# Plano cartmel-1.6 — Tipo da época garantido no banco e recusa mais clara na passagem

Issue #125 · ramo `roadmap/cartmel-1.6` · base 2c927d8 · triagem M3 (+M4).

## Passos (TDD: teste vermelho antes de cada mudança)

1. **Migração 7** no fim de `MIGRACOES` (`services/cartorio/src/banco.ts`): gatilho
   `trava_epoca_inteira BEFORE UPDATE OF epoca ON trava WHEN typeof(NEW.epoca) <> 'integer'` → `RAISE(ABORT)`.
   INSERT na trava já é barrado por `trava_nao_recria`; nenhum dado é reescrito (sem rebuild, sem CAST).
   Teste: `UPDATE trava SET epoca = 'abc'` (e `2.5`) falha; banco na v6 com época 3 abre na v7 com época 3.
2. **`destino_sem_acesso`** em `trava.ts`: em `passar`, quando a recusa seria `destino_desconhecido` e o PC existe
   (consulta na mesma transação), o motivo vira `destino_sem_acesso`. PC inexistente segue `destino_desconhecido`.
3. `RECUSA_TRAVA` (`servidor.ts`) com a mensagem pt-BR do novo motivo; texto de `destino_desconhecido` deixa de
   falar de acesso perdido.
4. `packages/nucleo/src/cartorio/tipos.ts`: + motivo em `MOTIVOS` (o validador usa a lista).
5. Testes: `trava.test.ts` (PC sem token e revogado → `destino_sem_acesso`), `cartorio.test.ts` (versão do esquema
   6 → 7), teste do validador do núcleo para o motivo novo.

## Fora
Tabela nova, rebuild da trava, editar migrações antigas.
