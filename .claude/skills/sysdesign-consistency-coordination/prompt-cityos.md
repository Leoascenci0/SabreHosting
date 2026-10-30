# sysdesign-consistency-coordination aplicado ao City OS Platform

Majoritariamente over-engineering pro estágio atual: o City OS roda num único primary Postgres (Supabase),
sem réplicas, sem sharding, sem múltiplos nós coordenando estado — não há CAP, quorum, Raft/Paxos ou 2PC pra
decidir, porque não há partição de rede entre nós a coordenar. O único pedaço que já vale pensar hoje, em
tom leve, é o *raciocínio* de invariante (ex.: um recálculo de `revenue_finance`/tax precisa de leitura
"read-your-writes" dentro da mesma sessão?) — não a maquinaria pesada. Isso só vira necessidade real quando
o produto crescer a ponto de precisar de réplicas de leitura entre estado/união ou múltiplas regiões
federativas simultâneas — bem além do estágio pré-receita atual.

```
Estou desenhando [descreva a operação, ex. recálculo de revenue_finance ou um fluxo de escrita
concorrente] no City OS Platform. O banco hoje é um único node Postgres/Supabase sem réplicas nem
sharding, então não preciso de quorum/consenso/2PC de verdade ainda. Use a skill
sysdesign-consistency-coordination só pra me ajudar a nomear a garantia de consistência que essa operação
específica precisa (ex. read-your-writes dentro da transação) — não para propor Raft, quorum distribuído
ou coordenação multi-nó, que não fazem sentido nessa topologia de banco único.
```
