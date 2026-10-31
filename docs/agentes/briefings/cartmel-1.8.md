# Briefing cartmel-1.8 — Teto do PUT sem enfeite, exemplo de endereço e faixa da rede privada

BASE: 555b02a62bdaac2d21401d736da5ee9f621d438d · RAMO: roadmap/cartmel-1.8 · MODELO: opus (gatilho: segurança da rede — onde o cartório escuta e para onde o app fala em http) · ISSUE: #132
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (rede); §enxugar
TRIAGEM (Máxima): M4 | ~25 linhas + ~40 de teste | RISCO alto (rede) | MIÚDO: não | ONDE: services/cartorio/src/servidor.ts:123-150 (PERMITIDOS: loopback, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7; conferirEndereco com exemplo 10.8.0.1); servidor.ts:449 bodyLimit do PUT (inerte: o teto real é o do armazém, leitor em fluxo); packages/nucleo/src/cartorio/cliente.ts:45-52 REDE_PRIVADA (onde o app aceita http) | PASSOS: 1. cartório escuta só em loopback (127.0.0.0/8, ::1) ou no IP do hub na rede privada 10.66.0.1 (ver decisão); 2. cliente do app aceita http só para 10.66.0.1 e loopback; fora disso, https (como hoje); 3. exemplo da mensagem → 10.66.0.1; 4. bodyLimit inerte do PUT: trocar por comentário que diz onde está o teto real (sem mudar o comportamento — teste do PUT igual); 5. testes: 10.8.0.1, 10.66.0.5, 172.16.0.1, 192.168.1.1, fd00::1 recusados no conferirEndereco; 127.0.0.1, ::1, 10.66.0.1 aceitos; cliente: http://10.0.0.5 recusado, http://10.66.0.1 aceito | NÃO ESCREVER: limite novo; mudança no filtro de clientes por IP (limiteFalhas) | PROVA: casos novos falham antes; teste do PUT inalterado; vistoria APROVADA (e como usuário comum se mexer em tests/infra — S-03).

## Item (texto literal do roadmap)
- [ ] **1.8 — Teto do PUT sem enfeite e exemplo de endereço coerente**
  *O que fazer:* tirar o `bodyLimit` inerte da rota `PUT /versoes/:n/pacote` (o teto real é o do armazém, leitor em
  fluxo) ou trocar por comentário; na mensagem de `conferirEndereco`, trocar o exemplo `10.8.0.1` por `10.66.0.1`.
  *Arquivo:* `services/cartorio/src/servidor.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste do PUT igual; teste do texto do erro.
  *Origem:* cartmel-1.2 · PR #69 · filha (achados baixos)

## Decisões que valem para este item
- Decidido pela Máxima (reversível): rede privada do SabreHosting = 10.66.0.0/24 (D2 + rede-1.4); o cartório só precisa escutar em 10.66.0.1 (hub) ou loopback; o app só fala http com 10.66.0.1 (ou loopback em teste). Achado do hostmel-1.4 (PR #122).
- Cartório com trustProxy desligado e filtro por IP da conexão (DECISOES 31/10): não mexer.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.8.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #132) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/. Atenção: o cartmel-1.4 roda em paralelo e acrescenta um teste de corrida no cartório (não mexa nele).

## O que NÃO decidir (perguntar à orquestradora)
nada
