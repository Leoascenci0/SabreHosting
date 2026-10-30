<!-- BEGIN roteador-modelo-esforco v2 -->
## Roteamento de modelo, esforço e linguagem (regra global do Eliel, perfil GOAT)

Vale neste projeto e em qualquer projeto novo. Fonte: skill `roteador-modelo-esforco` no repositório
`Leoascenci0/skills` (Regra 14 do `CLAUDE.md` global). Convenções específicas deste projeto vencem em conflito.

1. **Começar barato:** simples → Haiku/low; média (o caso comum) → **Sonnet/medium**; ambígua → Sonnet/high.
   **Opus/high é exceção** e precisa de gatilho dito na linha de roteamento: (1) ação irreversível ou em dado
   real (aplicar migração, apagar dados, auth/RLS, merge/deploy); (2) decisão de arquitetura; (3) 2 falhas
   verificadas em Sonnet/high; (4) revisar trabalho de risco alto. O projeto ser "de produção" **não** é gatilho:
   o risco é da ação, não do projeto. Editar código num ramo para PR é baixo/médio.
2. **Projetar antes:** volume, custo relativo (Haiku 1 · Sonnet 3 · Opus 5), chance de acerto e custo de errar;
   escolher o menor custo esperado.
3. **Duas camadas:** a sessão principal só classifica, projeta, delega e decide; o volume (leitura, varredura,
   edição, testes, rascunho) vai para subagente `haiku`/`sonnet` com retorno curto. Opus decide e revisa, não
   produz volume. Se a sessão está em Opus e a tarefa é barata, recomendar Sonnet/medium em uma frase.
4. **Verificar e escalar:** LIGHT em risco baixo/médio, FULL em risco alto. Falhou: um degrau acima, máx. 2
   tentativas por degrau; na 3ª parar e explicar.
5. **Auto-auditoria:** ao fechar, "usei Opus? qual gatilho?". Sem gatilho = erro de roteamento; partir mais
   barato na próxima tarefa parecida.
6. **Linguagem automática:** pt-BR; registro conforme o público (didático para o Eliel, formal administrativo,
   executivo, leigo). Forma não muda o modelo. Código, commits e PRs seguem a convenção do repositório.
7. **Relato:** `Roteamento: <classe>/<risco> → <modelo>·<esforço>·<LIGHT|FULL> | proj: … | gatilho Opus: …`.
<!-- END roteador-modelo-esforco v2 -->
