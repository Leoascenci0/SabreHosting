# Briefing sync-1.1 — Servir e pedir regiões pela rede privada

BASE: bdee52012c7fe65fea5ad11a54b8a400f47523e5 · RAMO: roadmap/sync-1.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade (hash, troca atômica); §seguranca (token, bind só no IP privado); §desempenho (streaming); sysdesign-resilience-failure (retomada)
TRIAGEM: M1+M3+M7 ~150 linhas + ~200 de teste, risco alto (estimar com folga: bkp-1.2 e cart-2.1 saíram 2-2,5x). Reaproveitar packages/nucleo/src/servidor/baixar.ts: baixarConferido (~l.201) já faz Range/If-Range, tentativas e descarte de parcial com hash errado — só precisa de cabeçalhos opcionais e de aceitar http no IP privado 10.66.0.x (validar, ~l.52; flag nova, ex. permitirHttpPrivado); integridade/hash.ts; backup/manifesto.ts e pacote.ts; cartorio/cofre.ts e cliente.ts (~l.134, molde do Bearer); rede/wireguard.ts (IP_DO_HUB, REDE 10.66.0.0/24); molde de servidor/Bearer/faixa de IP em services/cartorio/src/servidor.ts (conferirEndereco ~l.135, bearer ~l.173, envio com x-sabre-sha256 ~l.493; copiar a regra, não importar entre pacotes). Passos: estender baixar.ts; transferencia.ts: servidor node:http, bind SÓ no IP da rede privada do PC (recusa 0.0.0.0, loopback só em teste explícito), Bearer obrigatório, ETag=sha256, Range 206/416, streaming; cliente que pede arquivo por hash reaproveitando baixarConferido. Testes: queda no meio retoma com 206 e hash final igual; hash errado apaga parcial e não move ao destino; sem token 401; IP fora da rede privada recusado. Não escrever: cliente HTTP com retomada, conferência de hash, cofre de token.

## Item (texto literal do roadmap)
- [ ] **1.1 — Servir e pedir regiões pela rede privada**
  *O que fazer:* pequeno servidor HTTP no app, só no IP da rede privada e autenticado pelo token do grupo, que entrega arquivos de uma versão por hash; cliente que pede, retoma do ponto onde parou e confere o hash.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: conexão cortada no meio retoma; hash errado é descartado.
  *Depende de:* bkp-1.1, rede-1.3

## Decisões que valem para este item
DECIDIDO pela Máxima (segurança, reversível, 'decidi por você'): 'token do grupo' = o token por PC que cada PC já tem. O servidor NÃO guarda segredo: recebe uma função `conferirToken(token) → pc|null` injetada (em produção ela pergunta ao cartório `GET /eu`; nos testes é fake), então token revogado (cartmel-1.1) perde acesso ao sync automaticamente. Servidor nunca serve a pasta do mundo viva (regra de ouro 2): só arquivos de pacote/versão fechada indexados por hash, sem aceitar caminho do cliente (sem path traversal).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/sync-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (item de rede/serviço: ver S-03 no CLAUDE.md se tocar infra/)
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Mudar o formato do pacote/manifesto; ligar o servidor ao app (isso é do sync-2.1).
