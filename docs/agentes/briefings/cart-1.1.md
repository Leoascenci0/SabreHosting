# Briefing cart-1.1 — Serviço, banco e autenticação por token

BASE: 98891ae58ae781cdd1e0e1479463d5842017caef · RAMO: roadmap/cart-1.1 · MODELO: opus (gatilho: segurança da rede — autenticação do cartório) · ISSUE: #11
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; seguranca §1, §2, §4 e §5; integridade §1 (só para o desenho das tabelas; trava é o cart-1.2)
TRIAGEM: M6 (Fastify, já na arquitetura) + SQLite nativo `node:sqlite` (sem dependência) · ~150–200 linhas · risco
ALTO (cartório, segredo, rede) · MIÚDO: não. NÃO ESCREVER: better-sqlite3 (compilação nativa); token ou convite em
claro no banco ou no log; uso de convite em dois passos (SELECT e depois UPDATE); trava de host (é o cart-1.2);
versões do mundo (cart-1.3). PASSOS: 1) dependência `fastify` (linha em DECISOES.md); `node:sqlite` do Node 22
(`engines` do pacote cartorio `>=22.13`; o aviso ExperimentalWarning é aceito, registre em DECISOES.md);
2) migrações versionadas (tabela de versão do esquema) com `pcs`, `tokens`, `convites`; 3) token = 32 bytes
aleatórios (`crypto.randomBytes`), guardado só o SHA-256 (alta entropia dispensa scrypt), comparação pela coluna do hash;
4) convite: hash guardado, validade, uso atômico com `UPDATE ... WHERE usado_em IS NULL AND expira_em > agora` e
`changes === 1`; o uso do convite devolve o token do PC uma única vez; 5) Fastify recebe o endereço de escuta por
parâmetro/variável de ambiente, padrão `127.0.0.1`, e **recusa** `0.0.0.0`/`::` (o cartório só escuta na rede
privada); 6) log do Fastify com `redact` do cabeçalho de autorização e de qualquer token.
PROVA: testes com `fastify.inject` (sem abrir porta): sem token/token inválido → 401; token válido → 200; o token
em claro não aparece no banco (varrer o arquivo) nem no log capturado; convite usado duas vezes → recusado, inclusive
duas chamadas simultâneas; convite vencido → recusado; escutar em 0.0.0.0 → erro.

## Item (texto literal do roadmap)
- [ ] **1.1 — Serviço, banco e autenticação por token**
  *O que fazer:* Fastify escutando só na rede privada; SQLite com migrações; PCs, tokens (hash guardado, nunca o
  token), convites de uso único com validade. Log sem segredos.
  *Arquivo:* `services/cartorio/src/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: token inválido → 401; convite usado duas vezes → recusado.
  *Depende de:* base-1.1

## Decisões que valem para este item
- Arquitetura: cartório em Node + Fastify + SQLite; nenhum segredo no repositório (CLAUDE.md › Código aberto).
- Decidido pela Máxima (reversível): Fastify (não `node:http` puro) e `node:sqlite` nativo (não better-sqlite3).
- Segredo de administrador (quem cria convites): só por variável de ambiente, documentada num `.env.exemplo` sem valor.
- Rotas mínimas: `GET /saude` (sem token), `POST /convites` (só administrador), `POST /convites/usar` (troca convite
  por token do PC), `GET /eu` (com token, devolve o PC). Nomes em pt-BR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em services/cartorio/
- [ ] `npm run vistoria` APROVADA; banco de teste em pasta temporária apagada no fim
- [ ] PR com as seções do modelo, `Closes #11` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
