# Briefing hostmel-1.4 — Testes que faltam na configuração e endurecimento

BASE: 2582315b931419640cd1d6ab65215f4887b8d7f1 · RAMO: roadmap/hostmel-1.4 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #120
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (rede); §enxugar (não apagar octetosValidos)
TRIAGEM: M4 | ~30 linhas | RISCO alto (muda o IP em que o servidor escuta) | MIÚDO: não | REAPROVEITAR: packages/nucleo/src/servidor/configurar.ts:22 IP_PRIVADO; :24 octetosValidos; :35 gerarPropriedades; :54 bloco com "enable-rcon=false"; configurar.test.ts:13 base, :36 it.each "recusa IP", :41 it.each "aceita IP privado" | NÃO ESCREVER: função nova de IP; opção de tela; mudança nas assinaturas exportadas de configurar.ts (processo.ts importa) | PASSOS: 1. "10.999.0.1" no it.each de recusados (mutação: apagar octetosValidos derruba); 2. "enable-query=false" logo após "enable-rcon=false" + teste; 3. estreitar o IP aceito para PC definitivo da rede privada: 10.66.0.2 a 10.66.0.199 (ver decisão), mantendo octetosValidos; 4. atualizar os exemplos dos testes (10.8.0.5 → 10.66.0.5; 10.0.0.1, 172.16.0.1, 192.168.1.9, 10.8.0.5, 10.67.0.5, 10.66.0.1, 10.66.0.200 e 10.66.0.255 viram recusados); 5. grep para conferir que nada no app/exemplos passa IP fora da faixa (só relatar o que achar) | PROVA: casos novos falham antes; mutação conferida; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.4 — Testes que faltam na configuração e endurecimento**
  *O que fazer:* teste com `10.999.0.1` (octeto inválido) recusado — hoje apagar `octetosValidos` não derruba teste;
  gravar `enable-query=false` explícito; estreitar o IP aceito para a faixa da rede privada do WireGuard quando o
  rede-* a definir.
  *Arquivo:* `packages/nucleo/src/servidor/configurar.ts`, `packages/nucleo/src/servidor/configurar.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* remover `octetosValidos` faz um teste falhar; `server.properties` tem `enable-query=false`.
  *Origem:* host-1.2 · PR #20 · qa

## Decisões que valem para este item
- D2 (30/10): rede privada WireGuard própria; rede-1.4 (31/10): PCs definitivos 10.66.0.2–199, sala de entrada 10.66.0.200–254 (só alcança o cartório), hub 10.66.0.1.
- Decidido pela Máxima (reversível): o servidor só escuta em IP de **PC definitivo** (10.66.0.2–199). Hub (.1) e sala de entrada (200–254) recusados.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em configurar.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #120) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), segredo. Nada em processo.ts, comandos.ts, vigia.ts, apps/desktop, nucleo/cartorio (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada
