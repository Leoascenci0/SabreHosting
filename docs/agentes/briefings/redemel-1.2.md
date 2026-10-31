# Briefing redemel-1.2 — Ajudante por socket: acabamentos

BASE: 0966655c5da7c2d75f786b89349e81b30f0299d3 · RAMO: roadmap/redemel-1.2 · MODELO: opus (gatilho: segurança da rede — serviço root e firewall) · ISSUE: #141
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1, §seguranca (rede), §integridade (flock); docs/memoria/solucoes.md S-03
TRIAGEM (Máxima): M4 | ~40 linhas + ~80 de teste | RISCO alto | ONDE: infra/vps/instalar.sh:~204 (ufw allow in on wg0 to 10.66.0.1 port 7710 — sem origem); infra/vps/wg/ajudante-socket.sh:~52 (fallback head -n 1 do stderr pode trazer eco '+ wg set …'); services/cartorio/src/ajudante.ts pedirAoSocket (teto 4096 só sem \n no pedaço); tests/infra/ajudante-socket.test.ts | PASSOS: 1. ufw: 'from 10.66.0.0/24' (as regras da sala nas before.rules vêm antes e já barram 200–254; documente no LEIAME) ou faixa 2–199 se o ufw aceitar sem 9 regras — escolha a mais simples e explique; 2. wrapper: só devolve linha que começa com 'ERRO:'; sem ela, 'ERRO: falha interna do ajudante'; 3. cliente: acumula e corta em 4096 bytes no total, com ou sem \n; 4. testes: linha gigante e 2º pedido na mesma conexão → código 2 sem chamar o ajudante; 6 pedidos em paralelo → 6 IPs distintos; eco '+ wg' nunca volta; 5. instalar.sh: 'systemctl restart sabre-ajudante-entrada.socket' quando a unidade muda (ou daemon-reload + restart sempre — idempotente) | NÃO ESCREVER: mudança no contrato do pedido/resposta | PROVA: testes novos; tests/infra verde como root e como usuário comum (S-03: useradd -m teste; su teste).

## Item (texto literal do roadmap)
- [ ] **1.2 — Ajudante por socket: acabamentos**
  *O que fazer:* regra do ufw do cartório (7710 em wg0) só da faixa dos PCs definitivos 10.66.0.2–199 (ou documentar no
  LEIAME por que a sala já está coberta antes); o wrapper não devolve linha de eco `+ wg set …` no erro (filtrar); o cliente
  do socket no cartório limita a resposta a 4096 bytes mesmo quando o pedaço traz `\n`; testes de linha gigante e de 2º
  pedido na mesma conexão no wrapper; teste automático de concorrência (2+ pedidos em paralelo = IPs distintos);
  socket reiniciado quando a unidade muda numa reinstalação.
  *Arquivo:* `infra/vps/wg/ajudante-socket.sh`, `infra/vps/instalar.sh`, `infra/vps/LEIAME.md`,
  `services/cartorio/src/ajudante.ts`, `tests/infra/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso; `tests/infra` verde como root e como usuário comum (S-03).
  *Origem:* rede-1.5 · PR #97 · qa segurança + qa integridade

## Critério de pronto
- [ ] Plano em docs/agentes/planos/redemel-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) — ou, no ícone, as imagens geradas e mostradas no PR
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #141) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar PNG de captura), máquina da nuvem real, segredo. Só os arquivos do item.

## O que NÃO decidir (perguntar à orquestradora)
nada
