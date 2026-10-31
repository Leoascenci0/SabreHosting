# DECISÕES

> Uma linha por decisão do usuário, com data. Nunca apagar: se mudar, adicione a nova linha e marque a antiga como substituída.
> Todos os agentes leem este arquivo antes de começar.

| Data | Decisão | Contexto / tarefa |
|------|---------|-------------------|
| 2026-10-30 | Fluxo de trabalho via orquestrador (/ceo) + Skill Máxima + agentes especialistas; o orquestrador não executa, só delega | Setup (adaptado do SEURBH) |
| 2026-10-30 | Projeto de código aberto, repositório público no GitHub, licença MIT. Não precisa de Cloudflare: GitHub hospeda código e versões | Conversa de criação |
| 2026-10-30 | Arquitetura: um host por vez (o PC mais forte online), troca automática sem queda via proxy Velocity + sala de espera, mundo salvo nos PCs e na nuvem, cartório como fonte da verdade (docs/arquitetura.md) | Conversa de criação |
| 2026-10-30 | Nome do projeto: **SabreHosting** (repositório `SabreHosting`) | Conversa de criação |
| 2026-10-30 | Launcher: integrar ao Prism agora (o Prism faz o login da Microsoft) e ter launcher próprio depois, pedindo a aprovação da Microsoft em paralelo; nunca copiar código GPL do Prism | Conversa de criação (docs/roadmap-lanc.md) |
| 2026-10-30 | Google Drive fica opcional, só histórico longo de pacotes fechados (nunca a pasta do mundo ao vivo) | Conversa de criação |
| 2026-10-30 | Descartado: dividir o processamento do mundo entre vários PCs (ver docs/memoria/visao.md) | Conversa de criação |
| 2026-10-30 | **D8:** app desktop em **Electron + TypeScript** (não Tauri) | base-1.1, app-* |
| 2026-10-30 | **D1:** edição **Java** do Minecraft (Bedrock fica fora; Geyser segue no Backlog) | host-1.1, lanc-1.2 |
| 2026-10-30 | **D5:** servidor **com mods de todos os tipos, Fabric e Forge ao mesmo tempo** (resposta do Eliel: "os dois ao mesmo tempo"). Caminho técnico proposto pela Máxima: servidor **NeoForge + Sinytra Connector** (roda mods Fabric dentro do NeoForge). Limites ditos: nem todo mod Fabric funciona no Connector e a versão do Minecraft fica presa às que o Connector suporta. Substitui o "Paper" da arquitetura. A versão do Minecraft continua decisão do Eliel | host-1.1, lanc-1.2, lanc-1.4 |
| 2026-10-30 | **Node 22 LTS** (`.nvmrc` = 22, `engines.node >=22`); versões exatas ficam no `package-lock.json` | base-1.1 (decidido pela Máxima) |
| 2026-10-30 | Dependências de desenvolvimento do monorepo (todas MIT/Apache-2.0, só em dev, não vão no instalador): `typescript` (tipos estritos, Apache-2.0), `eslint` + `typescript-eslint` (regras de código, MIT), `prettier` (estilo, MIT), `vitest` (testes, MIT), `@types/node` (tipos do Node, MIT) | base-1.1 |
| 2026-10-30 | **Electron entra no app-1.1**, não antes: `apps/desktop` fica só com package.json, tsconfig e teste de exemplo | base-1.1 (decidido pela Máxima) |
| 2026-10-30 | Dependência **`fastify`** (servidor HTTP do cartório, MIT) só em `services/cartorio`, não vai no instalador do app; escolhida pela validação de corpo por esquema e pelo log com `redact` embutidos | cart-1.1 (decidido pela Máxima) |
| 2026-10-30 | Banco do cartório em **`node:sqlite`** nativo do Node (sem dependência nem compilação, ao contrário do `better-sqlite3`); `engines` do cartório `>=22.13`; o aviso `ExperimentalWarning` do Node é aceito | cart-1.1 (decidido pela Máxima) |
| 2026-10-30 | Nota do PC: escala **100 = PC de referência, sem teto em cima** (não 0–100), para a regra "nota nova ≥ 1,3 × nota do host" funcionar com hosts fortes. Decidido pela Máxima (reversível) | host-2.3, migra-1.1 |
| 2026-10-30 | Autenticação dos jogadores: o **proxy Velocity confere a conta Microsoft** (`online-mode=true` no proxy); o servidor do host fica com `online-mode=false`, escuta **só no IP da rede privada** e confia no proxy pelo encaminhamento "modern forwarding". **Whitelist ligada por padrão**; quem entra na lista é regra do grupo (Eliel). Decidido pela Máxima (segurança da rede, reversível) | host-1.2, rede-2.1 |
| 2026-10-30 | Comandos ao servidor (salvar, avisar, listar) pelo **console do processo** (stdin/stdout), **não por RCON**: nenhuma porta de rede nem senha a mais. Decidido pela Máxima (segurança, reversível) | host-2.2 |
| 2026-10-30 | Dependência **`tar`** (ISC, mantida pelo time do npm) só em `packages/nucleo`, para o pacote do mundo em `.tar.gz` com `node:zlib` (zstd ainda não é estável no Node 22). Decidido pela Máxima (reversível) | bkp-1.2 |
| 2026-10-31 | Sala de espera = **PicoLimbo (MIT)**, programa separado só baixado e executado na máquina da nuvem (hash fixado em `infra/vps/limbo/limbo-release.env`, ainda a preencher), escutando só em 127.0.0.1:25566. NanoLimbo (GPL-3.0) descartado por licença | rede-2.3 |
| 2026-10-30 | **D6:** regras do grupo nos padrões — guardar os 10 backups mais recentes + 1 por dia dos últimos 7 dias; trocar de host só com nota ≥ 1,3 × a do host; pode hospedar quem ligar a opção no próprio app. Tudo ajustável em Configurações | bkp-2.1, migra-1.1 |
| 2026-10-30 | **D2:** rede privada com **WireGuard próprio** na máquina da nuvem (hub), sem Tailscale nem playit.gg | rede-1.1, rede-1.3 |
| 2026-10-30 | **D3:** máquina na nuvem na **Oracle Cloud Always Free em São Paulo** (ARM). O cadastro é do Eliel, no item que cria a máquina | rede-1.1, rede-1.2 |
| 2026-10-30 | **D4:** ícone enviado pelo Eliel (tigre-dente-de-sabre + blocos de grama), em `apps/desktop/recursos/icone/` | app-1.1 |
| 2026-10-31 | **Testar daqui, nunca esperar o CI:** o merge é decidido pela vistoria rodada na própria sessão (worktree do ramo com a main mesclada); não se espera o check do GitHub nem se agenda aviso para isso | Regra do Eliel (CLAUDE.md › Visão técnica) |
