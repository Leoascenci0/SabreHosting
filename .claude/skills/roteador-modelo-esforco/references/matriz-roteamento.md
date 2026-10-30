# Matriz de roteamento (modelo + esforço + verificação)

Modelos conforme o vídeo e o ambiente (Haiku 4.5, Sonnet 5.5, Opus 5.5; tier acima, Fable/Mythos, se existir).
**Atualizar quando os modelos mudarem**; a lógica por tier permanece. Preço relativo do vídeo: ~1× / ~3× / ~5×
(conferir preços atuais antes de citar valores).

Princípio: **executar no barato, verificar no forte só onde o risco pede**. Por isso a tabela separa quem
executa de quem verifica.

| Demanda | Executa | Verifica | Observação |
|---|---|---|---|
| Typo, renomear, texto, CSS, comando git | Haiku · low | LIGHT | |
| Varrer, listar, resumir arquivos, logs, diffs | Haiku (subagente) · low | amostra | retorno curto |
| Tela, componente, endpoint CRUD, teste unitário, script | Sonnet · medium | LIGHT | caso comum |
| Bug com pista, refactor de poucos arquivos | Sonnet · medium | LIGHT | |
| Bug sem pista, refactor multi-arquivo | Sonnet · high | LIGHT→FULL | Opus só após 2 falhas |
| Escrever o arquivo `.sql` de migração (sem aplicar) | Sonnet · high | FULL (Opus revisa) | gerar barato, revisar forte |
| **Aplicar** migração em banco real, mexer em auth/RLS | Opus · high | FULL + advisors/logs + rollback | gatilho 1 |
| Decisão de arquitetura / modelo de dados / contrato público | Opus · high | revisão independente | gatilho 2 |
| Ofício, memorial, parecer (texto) | Sonnet · medium | revisão de fatos e números | Opus só se for decisório |
| Dúvida conceitual, conversa | o da sessão (ou Haiku) · low | nenhuma | |
| Problema difícil sem pista após Opus/high | Opus · max | FULL | último degrau |

## Reclassificação de risco (o erro que gera "tudo em Opus")

O risco é da **ação**, não do **projeto**.

| Parece alto, mas é... | Classe real |
|---|---|
| Editar código de projeto "de produção" num ramo para PR | baixo/médio (reversível por revisão e git) |
| Escrever migração/SQL sem aplicar | médio |
| Mexer em texto/lista/tela de TI | baixo/médio |
| Assunto LGPD/prefeitura em texto de documentação | médio (revisão de fatos), não Opus |
| Rodar teste, build, lint | baixo |

Alto de verdade: aplicar em banco real, apagar dados, permissões/RLS, merge/deploy, emissão oficial, dinheiro.

## Sinais para descer

Tarefa repetitiva já resolvida no mesmo projeto; mudança de uma linha com teste existente; só leitura; mesma
classe passou limpa duas vezes no barato (ver `calibracao.md`).

## Sinais para subir antes de começar

Ação irreversível ou em dado real; requisito contraditório com várias partes móveis; falha anterior verificada
no mesmo item.

## Verificação

- **LIGHT:** reler diff, lint, typecheck, rodar o teste mais próximo.
- **FULL:** suíte, build, ponta a ponta quando couber, agente revisor independente e, no Supabase,
  `get_advisors`, `list_migrations`, `query_logs` depois de mudar schema.
