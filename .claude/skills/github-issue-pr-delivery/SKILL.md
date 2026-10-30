---
name: github-issue-pr-delivery
description: Planejar e executar desenvolvimento incremental orientado por GitHub Issues e Pull Requests. Usar quando um projeto de software precisar converter planos ou prompts grandes em tarefas pequenas, coordenar agentes distintos, vincular PRs a issues, definir critérios de aceite, auditoria, testes e observabilidade proporcionais ao risco.
---

# Entrega incremental com GitHub Issues e PRs

## 1. Respeitar o contrato do projeto

Ler `AGENTS.md`, `CLAUDE.md`, plano, estado atual e convenções do repositório. Preservar regras locais. Tratar instrução do usuário sobre escopo, fase, repositórios permitidos e autorização de implementação como limite. Uma skill não cria autorização para codificar, publicar, mesclar ou implantar.

Se o plano estiver em construção, produzir backlog e modelos sem iniciar implementação. Separar status `planejado`, `pronto`, `bloqueado`, `em execução` e `aceito`.

## 2. Traduzir demandas em unidades verificáveis

Para cada demanda ampla, identificar entregas, dependências, fonte de requisitos, arquivos/módulos prováveis, teste e aceite. Criar uma issue somente para tarefa pronta e suficientemente pequena para revisão. Se envolver vários motores, telas, formatos ou decisões externas, dividir em subtarefas antes do código. Vincular cada ID do plano ao número da issue. Pesquisar o ID antes de criar para evitar duplicatas.

Uma issue deve responder:

- **Resultado:** qual artefato ou comportamento observável será entregue.
- **Entrada:** dado autorizado, versão, fonte e pré-condições.
- **Limite:** o que cabe nesta tarefa e o que pertence a outra.
- **Aceite:** teste reproduzível, resultado esperado, tolerância quando numérica e evidência necessária.
- **Dependência/bloqueio:** issue precedente, decisão pendente, ambiente ou acesso externo.

Não abrir centenas de issues imaturas apenas para espelhar um documento extenso. Planejar o conjunto em arquivo versionado e abrir a próxima onda pronta.

## 3. Implementar e revisar por PR

Criar branch isolada segundo a convenção do repositório. Fazer mudança limitada à issue; usar commits legíveis. No corpo do PR, citar issue, ID do plano, resumo da mudança, testes, evidências, limites e riscos. Usar `Refs #n` quando a entrega for parcial. Usar `Closes #n` somente quando todo o aceite estiver satisfeito. Não declarar PR concluído por ter aberto a página ou obtido CI verde.

Revisar o diff contra os requisitos e fontes; conferir regressões e incoerências entre interface, dados, cálculos e artefatos. Corrigir defeitos encontrados e registrar evidência após correção. Respeitar aprovações e portões do projeto antes de merge ou deploy. Atualizar o estado e preparar handoff só depois do encerramento real do item.

## 4. Selecionar qualidade e observabilidade pelo impacto

| Mudança | Verificações pertinentes |
|---|---|
| Modelo, cálculo ou regra | Casos independentes, invariantes, unidades, limites e regressão |
| Persistência, importação ou sincronização | Round trip, conflitos, duplicação, falha parcial e idempotência |
| Interface e documento | Fluxo no navegador, legibilidade, acessibilidade, impressão e revisão de números |
| Serviço ou integração em execução | Logs com ID de operação, métricas/traces úteis, erros e privacidade |
| Emissão ou entrega completa | Teste ponta a ponta e conferência cruzada de mesma versão/revisão |

Escolher ferramentas depois de verificar pilha, custo, licença, dados e necessidade. Sentry, OpenTelemetry, Playwright, linters e cobertura são opções, não uma lista automática de instalações. Uma animação de UI não substitui clareza, desempenho e uso profissional.

## 5. Compartilhar o padrão entre agentes

Se o projeto pedir, registrar regras curtas em `AGENTS.md` e adaptar documentos de agentes já existentes sem sobrescrever convenções. O documento deve apontar para plano, estado, issue/PR e auditoria, sem repetir especificações inteiras. Fazer leitura de retorno do GitHub após criar issue, PR ou arquivo.

### Cartão mínimo

```md
[ID] Resultado específico
Origem: requisito e fonte
Dependências: IDs e ambiente
Escopo: uma alteração revisável
Aceite: caso, resultado esperado, tolerância, evidência
PR: mudança, testes, limitações; Refs/Closes #n conforme o resultado
```
