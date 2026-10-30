# sysdesign-resilience-failure aplicado ao City OS Platform

Parcialmente aplicável hoje, na camada mais barata da skill: todo endpoint que chama uma dependência externa
(Supabase, um serviço de geração de PDF, o pipeline Blender headless) já se beneficia de timeout definido e,
quando a escrita não é idempotente (recálculo de `revenue_finance`/tax), de uma idempotency key — isso é
barato e vale a pena mesmo em free-tier. O que é over-engineering agora é a maquinaria pesada da skill
(circuit breaker, bulkhead, redundância N>1, failover multi-região) — isso é machinery pra chamadas
cross-processo/cross-rede em sistemas com múltiplas réplicas, e o City OS hoje é um único serviço web sem
réplicas a coordenar.

```
Estou revisando a resiliência de [descreva a chamada, ex. "o endpoint que chama o pipeline Blender
headless" ou "o recálculo de revenue_finance"] no City OS Platform. Use a skill sysdesign-resilience-failure
só pro nível básico: timeout adequado pra essa dependência, e se a operação precisa de idempotency key
(→ ver também sysdesign-api-design) por não ser segura pra repetir. Não proponha circuit breaker, bulkhead
ou redundância N>1 — o projeto roda hoje como um único serviço web no Render sem réplicas, então essa
maquinaria não tem o que proteger ainda.
```
