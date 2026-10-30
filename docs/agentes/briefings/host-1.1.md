# Briefing host-1.1 — Baixar Java e servidor com hash conferido

BASE: 98891ae58ae781cdd1e0e1479463d5842017caef · RAMO: roadmap/host-1.1 · MODELO: sonnet (esforço alto) · ISSUE: #10
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure (só retomada de download)
LEIA: qualidade-sabre §1; seguranca §3 (Downloads e execução) e §4; integridade §3 e §6; desempenho (só transferência/stream)
TRIAGEM: M7 (só APIs nativas do Node 22: fetch, node:crypto, node:fs, streams; sem dependência nova) · ~120–160 linhas ·
risco ALTO (download + hash) · MIÚDO: não. NÃO ESCREVER: cliente HTTP/biblioteca de download; ler o arquivo inteiro na
memória; baixar direto para o nome final; confiar só no Content-Length. PASSOS: 1) núcleo genérico
`baixarConferido({url, hashEsperado: {algoritmo: 'sha256'|'sha512'|'sha1', valor}, destino})`: baixa para
`<destino>.parcial` (mesma pasta, para o rename ser atômico), retoma com `Range` + `If-Range` (ETag/Last-Modified);
se o servidor responder 200 em vez de 206, recomeça do zero; hash em stream; divergente → apaga o parcial e recusa
com mensagem pt-BR; igual → `rename` atômico. Cache: arquivo final já existe e o hash bate → não baixa de novo.
2) resolvedores puros (recebem o JSON da API, devolvem url + hash): Adoptium (`binary.package.checksum`, sha256),
Modrinth (`files[].hashes.sha512`) para Sinytra Connector e Forgified Fabric API, NeoForge (instalador no Maven
oficial + sidecar `.sha1`/`.sha256` do mesmo Maven). 3) versões (Minecraft, NeoForge, Java) são **parâmetros
obrigatórios, sem padrão**.
PROVA: servidor HTTP falso local (node:http) nos testes: hash certo → renomeia; hash errado → recusa e não deixa
arquivo final nem parcial; queda no meio → retoma com 206; 200 no lugar de 206 → recomeça; segunda chamada usa o cache
(zero requisições). Resolvedores testados com JSON de exemplo escrito à mão (fixture).

## Item (texto literal do roadmap)
- [ ] **1.1 — Baixar Java e servidor com hash conferido**
  *O que fazer:* módulo que baixa o Java (Adoptium, versão fixada) e o servidor NeoForge (instalador do repositório Maven oficial do NeoForge, D5) mais o Sinytra Connector e a Forgified
  Fabric API (Modrinth) para a
  pasta do app, confere SHA-256, guarda em cache e nunca re-baixa à toa. Download retomável; falha com mensagem pt-BR.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.ts`, testes com servidor HTTP local falso
  **Tela no app:** não se aplica (a versão vem do grupo, item cart).
  *Confirmação:* teste: hash errado → recusa e apaga; hash certo → usa o cache na segunda vez.
  *Depende de:* base-1.1 · D1 (Java) e D5 (NeoForge + Connector) decididas

## Decisões que valem para este item
- D1 (Java) e D5 (servidor NeoForge + Sinytra Connector + Forgified Fabric API, para rodar mods Forge e Fabric juntos).
- **A versão do Minecraft é decisão do Eliel** (ainda não tomada): nada de versão fixa no código; os testes usam
  versões inventadas nas fixtures.
- **Sem internet na sessão** (o proxy bloqueia Adoptium, Modrinth, Maven do NeoForge): nenhum teste chama a rede de
  verdade. Escreva no PR, em "O que NÃO foi confirmado", que os formatos das APIs vieram da documentação e não foram
  conferidos ao vivo.
- O sidecar `.sha1` do NeoForge vem do mesmo servidor do arquivo (protege contra download corrompido, não contra
  servidor comprometido). Diga isso no PR; a melhoria (tabela de hashes fixada por versão, conferida pelo grupo) vai
  em "Melhorias encontradas".
- Rodar o instalador do NeoForge e aceitar o EULA **não** é deste item (é o host-1.2).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/host-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/test/ ou ao lado do módulo
- [ ] `npm run vistoria` APROVADA; nenhum arquivo baixado sobra no repo nem em /tmp
- [ ] PR com as seções do modelo, `Closes #10` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
A versão do Minecraft/NeoForge (fica como parâmetro).
