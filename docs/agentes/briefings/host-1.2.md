# Briefing host-1.2 — EULA e configuração do servidor

BASE: 88db9287f01a644ac6475348d42b30d8c4835564 · RAMO: roadmap/host-1.2 · MODELO: sonnet (esforço alto; revisão com duas lentes) · ISSUE: #17
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1 (Rede) e §4; docs/arquitetura.md §2 (proxy e rede privada)
TRIAGEM: M7 (+M2 só para os 2 campos de distância) · ~100 linhas (+~90 teste) · risco ALTO (rede: porta e online-mode)
· MIÚDO: não. NÃO ESCREVER: sistema de configurações (não existe; parâmetros com padrão; a tela é do app-2.2); tela de
aceite do EULA (é app-1.x: só a função que expõe a pergunta e o texto/link do EULA); mexer em `baixar.ts` (outro item da
onda mexe nele); plugin/mod de encaminhamento do proxy (é rede-2.1). PASSOS: 1) função pura `gerarPropriedades(opcoes)`
→ texto do `server.properties` (testada sem disco); 2) `gerarEula(aceite)` → `eula=true` só com aceite explícito
(objeto com data/hora do aceite), senão `eula=false`; 3) `podeSubir(pasta)` recusa com mensagem pt-BR se o eula não
for true; 4) validar distâncias (simulação < visão, faixas do Minecraft) e porta; 5) gravar os dois arquivos com troca
atômica (temporário na mesma pasta + rename).
PROVA: sem aceite → `eula=false` e `podeSubir` recusa; propriedades geradas com `server-ip` = IP da rede privada
recebido por parâmetro (recusa 0.0.0.0, vazio e IP público), `online-mode=false`, `white-list=true`,
`enforce-whitelist=true`, `enable-rcon` desligado (RCON é host-2.2); simulação ≥ visão → recusa.

## Item (texto literal do roadmap)
- [ ] **1.2 — EULA e configuração do servidor**
  *O que fazer:* gerar `server.properties` e `eula.txt` a partir das Configurações (porta só na rede privada,
  whitelist ligada, `online-mode` conforme o proxy, `simulation-distance` < `view-distance`). O EULA só vira `true`
  depois de o usuário aceitar na tela (o núcleo expõe a pergunta; a tela vem no app-1.x).
  *Arquivo:* `packages/nucleo/src/servidor/configurar.ts`
  **Tela no app:** Configurações › Servidor › (distância de visão, distância de simulação).
  *Confirmação:* teste: sem aceite, `eula=false` e o servidor não sobe.
  *Depende de:* host-1.1

## Decisões que valem para este item
- D1 Java, D5 NeoForge + Sinytra Connector.
- **Decidido pela Máxima (segurança da rede, reversível):** quem confere a conta Microsoft é o proxy Velocity
  (`online-mode=true` lá, item rede-2.1). O servidor do host fica com `online-mode=false`, **só escuta no IP da rede
  privada** (nunca 0.0.0.0, nunca porta aberta no PC do amigo) e confia no proxy pela senha de encaminhamento "modern
  forwarding" (o mod que faz isso no NeoForge entra no rede-2.1; aqui só deixe a configuração pronta para recebê-lo e
  documente no PR que, sem ele, o servidor não deve ser exposto). Conta pirata/offline continua proibida: o proxy barra.
- **Whitelist ligada por padrão** (`white-list=true` + `enforce-whitelist=true`); quem entra na lista é regra do grupo
  (D6, do Eliel) e vem do cartório depois.
- O EULA da Mojang: o projeto nunca aceita por ninguém; a função recebe o aceite do usuário (CLAUDE.md › Código aberto).
- Tela no app: os campos (distância de visão, de simulação) ficam como parâmetros com padrão (visão 10, simulação 8);
  a tela Configurações › Servidor é do app-2.2.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/host-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #17` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Quem entra na whitelist; versão do Minecraft.
