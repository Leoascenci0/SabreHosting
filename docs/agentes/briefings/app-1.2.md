# Briefing app-1.2 — Tela inicial: Jogar / Hospedar e status

BASE: 06f6bd73fd15cb52068d1114637525f5b3959bf7 · RAMO: roadmap/app-1.2 · MODELO: sonnet·high (sem gatilho Opus; revisão com lente integridade por acionar a trava) · ISSUE: #71
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1; references/interface.md; references/integridade.md (regra de ouro 1); impeccable `audit` e `polish` antes de entregar
TRIAGEM: M5 + M1 (+M7 só na cola IPC) · ~230 linhas (produto ~130, E2E ~100) · risco ALTO (Hospedar aciona a trava, sem lógica de trava nova) · MIÚDO: não.
- 4 estados ("carregando" é flag do botão, não estado): (1) sem conexão com o cartório (motivo rede/servidor/acesso + "Tentar de novo"); (2) ninguém hospedando → Hospedar; (3) outro PC hospeda → "Servidor no PC do X" + Jogar; (4) eu hospedo → Parar + Jogar.
- REAPROVEITAR: `packages/nucleo/src/cartorio/hospedar.ts` `hospedar()` (pega trava, sobe, perde trava → para); `cartorio/cliente.ts` `criarCliente` (confira o nome real do método que lê a trava antes de usar); `cartorio/tipos.ts` `EstadoTrava`, `Pc`; `migracao/decidir.ts` `decidirHost`; `servidor/processo.ts` `EstadoServidor` (iniciarServidor SÓ via hospedar); `apps/desktop/src/main/principal.ts` (guarda `SABRE_E2E===1`); `preload.cts` (molde de ponte).
- PONTE: `window.sabre.inicio = { estado(); jogar(): Promise<{copiado, endereco}>; hospedar(): Promise<Resultado>; parar(): Promise<Resultado>; aoProgresso(cb): () => void }`; `EstadoInicio = {tipo:"carregando"} | {tipo:"sem-cartorio"; motivo} | {tipo:"ninguem"} | {tipo:"outro"; nomePc; endereco} | {tipo:"eu"; endereco}`; `Resultado = {ok:true} | {ok:false; mensagem}` (pt-BR, sem termo técnico). Handlers IPC conferem o remetente como no app-1.1 e validam argumentos.
- DECIDI (Máxima, reversível): Jogar neste item só COPIA o endereço (área de transferência) e mostra "Endereço copiado"; abrir o Prism já conectado é do lanc-1.3. Parar pede confirmação ("Os amigos conectados vão cair. Parar o servidor?").
- Sem configuração de cartório ainda (a tela de primeira vez é o app-1.3): sem endereço/token configurado → estado "sem-cartorio" com motivo "acesso" e texto "Este PC ainda não entrou no grupo".
- FAKE no E2E: `SABRE_E2E=1` + `SABRE_E2E_CENARIO=ninguem|outro|eu|sem-cartorio` injeta um cliente de cartório falso e um `iniciarServidor` espião (prova que nenhuma porta abre e nenhum arquivo de mundo é tocado; dados em mkdtemp); o `hospedar` real continua no caminho. O código de fake não pode ser alcançável sem `SABRE_E2E=1`.
- Ligação de workspace: `apps/desktop` hoje não declara `@sabrehosting/nucleo` nem tsconfig references; ligar (5–10 linhas) e conferir com `npm ci`.
- Capturas: o E2E grava `docs/imagens/app-1.2-<estado>.png` dos 4 estados (tema claro) e avise a orquestradora (send_message) quando estiverem no ramo enviado.
NÃO ESCREVER: lógica de trava/renovação na tela ou no preload; atalho que sobe servidor sem `hospedar`; chamada direta a iniciarServidor; leitura do Prism (lanc); tela de primeira vez (app-1.3); cópia do mundo.

## Item (texto literal do roadmap)
- **1.2 — Tela inicial: Jogar / Hospedar e status** — estado vindo do núcleo/cartório: "Servidor no PC do X" + Jogar (copia o endereço / abre o launcher); "Ninguém hospedando" + Hospedar; progresso em toda ação demorada. *Arquivo:* `apps/desktop/src/telas/inicio.*` (pode seguir o molde do app-1.1 em `src/ui/`; arquivos extras autorizados: `apps/desktop/src/main/*`, `preload.cts`, `apps/desktop/e2e/`, `apps/desktop/package.json`, `tsconfig*`, lock raiz, `docs/imagens/`, `docs/design-system.md` se acrescentar componente). **Tela no app:** não se aplica. *Confirmação:* E2E com núcleo falso nos 4 estados. *Depende de:* app-1.1, host-2.1.

## Decisões que valem
- D8 Electron + TypeScript; ponte segura do app-1.1 (contextIsolation, sandbox, CSP). Regra de ouro 1: sem trava, não sobe servidor.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.2.md como primeiro commit
- [ ] E2E nos 4 estados (texto, botões, carregando, espião sem porta) + testes unitários da cola
- [ ] `npm run vistoria` APROVADA; `audit` do impeccable sem crítico
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir
Nada (decidido acima).
