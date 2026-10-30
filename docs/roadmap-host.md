# Roadmap — Host (rodar o servidor Minecraft num PC)

Objetivo: o núcleo consegue baixar, configurar, iniciar, controlar e parar um servidor Minecraft no PC de quem
hospeda, com segurança e sem atrapalhar o jogo de quem está no mesmo PC.

**Sigla `host`.** Ramos `roadmap/host-<id>`. Regras do cabeçalho de `roadmap-base.md` valem aqui. Código em
`packages/nucleo/src/servidor/`. Na nuvem os testes usam um **servidor falso** (processo que imita o console e o RCON);
o servidor real só roda na Confirmação, num PC.

## Bloco 1 — Baixar e preparar

- [ ] **1.1 — Baixar Java e servidor com hash conferido**
  *O que fazer:* módulo que baixa o Java (Adoptium, versão fixada) e o jar do servidor (API oficial do Paper, D5) para a
  pasta do app, confere SHA-256, guarda em cache e nunca re-baixa à toa. Download retomável; falha com mensagem pt-BR.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.ts`, testes com servidor HTTP local falso
  **Tela no app:** não se aplica (a versão vem do grupo, item cart).
  *Confirmação:* teste: hash errado → recusa e apaga; hash certo → usa o cache na segunda vez.
  *Depende de:* base-1.1 · **ESPERA DECISÃO D1, D5**

- [ ] **1.2 — EULA e configuração do servidor**
  *O que fazer:* gerar `server.properties` e `eula.txt` a partir das Configurações (porta só na rede privada,
  whitelist ligada, `online-mode` conforme o proxy, `simulation-distance` < `view-distance`). O EULA só vira `true`
  depois de o usuário aceitar na tela (o núcleo expõe a pergunta; a tela vem no app-1.x).
  *Arquivo:* `packages/nucleo/src/servidor/configurar.ts`
  **Tela no app:** Configurações › Servidor › (distância de visão, distância de simulação).
  *Confirmação:* teste: sem aceite, `eula=false` e o servidor não sobe.
  *Depende de:* host-1.1

## Bloco 2 — Controlar

- [ ] **2.1 — Iniciar e parar com flags certas**
  *O que fazer:* iniciar o Java com RAM pela nota do PC e flags conhecidas (Aikar), prioridade normal; parar com `stop`
  e esperar sair; matar só se passar do prazo, avisando no log. Estado observável (parado, subindo, pronto, parando).
  *Arquivo:* `packages/nucleo/src/servidor/processo.ts`, servidor falso em `packages/nucleo/test/ajuda/`
  **Tela no app:** Configurações › Servidor › Memória máxima (automático por padrão).
  *Confirmação:* teste com o servidor falso: ciclo completo de estados; parada demorada mata após o prazo.
  *Depende de:* host-1.2

- [ ] **2.2 — Console/RCON: salvar, pausar gravação, avisar no chat**
  *O que fazer:* cliente RCON (ou console via stdin) com `save-off`, `save-all flush` (esperando a confirmação),
  `save-on`, `say`, `list`. Senha RCON gerada por sessão, nunca gravada no git.
  *Arquivo:* `packages/nucleo/src/servidor/comandos.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `salvarSeguro()` só devolve depois do "Saved the game" do servidor falso.
  *Depende de:* host-2.1

- [ ] **2.3 — Nota do PC (benchmark)**
  *O que fazer:* medir CPU (um núcleo e vários, teste curto), RAM livre e upload (contra o cartório, quando houver;
  até lá, parâmetro) e gerar uma nota de 0 a 100 com a fórmula documentada. Rodar no 1º uso e semanalmente, nunca com
  jogo aberto.
  *Arquivo:* `packages/nucleo/src/nota/`
  **Tela no app:** Configurações › Geral › "Permitir que meu PC hospede" (liga/desliga).
  *Confirmação:* teste: fórmula determinística dada uma medição; benchmark leva < 15 s.
  *Depende de:* base-1.1

## Bloco 3 — Prova no PC

- [ ] **3.1 — Roteiro de prova manual no Windows**
  *O que fazer:* script de linha de comando (`npx sabre-host`) que baixa, configura e sobe um servidor real com um
  mundo novo, para o Eliel testar num PC; tutorial em `docs/tutoriais/`.
  *Arquivo:* `packages/nucleo/src/cli/host.ts`, `docs/tutoriais/host-prova-no-pc.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel entra no servidor pelo `localhost` no PC dele. **[P: teste no PC do Eliel]**
  *Depende de:* host-2.2
