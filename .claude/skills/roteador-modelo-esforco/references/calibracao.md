# Calibração do router (aprende com o uso)

O GOAT do vídeo "aprende": cada resultado ajusta a próxima escolha. Aqui isso é uma tabela de pontos de partida
por classe de tarefa, atualizada a cada tarefa concluída.

## Tabela inicial (pontos de partida)

| Classe | Partida | Sobe quando |
|---|---|---|
| Ajuste de texto/CSS/rótulo | Haiku · low | teste falha ou causa obscura |
| Tela nova/alterada, endpoint CRUD | Sonnet · medium | design ambíguo → high |
| Bug com pista | Sonnet · medium | 2 falhas → Sonnet/high, depois Opus/high |
| Migração (escrever) | Sonnet · high + revisão Opus | revisão achou falha estrutural |
| Migração (aplicar), RLS, auth | Opus · high | nunca desce |
| Documento administrativo | Sonnet · medium | decisório ou contestável → Opus/high para revisar |
| Varredura/leitura grande | Haiku (subagente) · low | resultado incoerente |

## Como registrar (uma linha por tarefa relevante)

`AAAA-MM-DD | classe | par inicial | par final | escalou? motivo | custo rel`

Exemplo: `2026-10-02 | tela nova | Sonnet·medium | Sonnet·medium | não | 3`

Onde: na memória do projeto (Regra 10 do `CLAUDE.md` global), como linha curta; se não houver memória, mencionar
na resposta final. Não criar arquivo no repositório do projeto só para isso.

## Regras de ajuste

1. Duas tarefas seguidas da mesma classe sem escalada: **descer** um degrau o ponto de partida (se já não for
   Haiku/low).
2. Escalada por falha verificável: **subir** o ponto de partida da classe um degrau, mas só para a mesma
   subclasse (não generalizar).
3. Auto-auditoria (Regra 5): Opus/high sem gatilho declarado conta como erro de roteamento e reseta a partida
   da classe para Sonnet/medium.
4. Revisar a tabela quando os modelos ou preços mudarem.
