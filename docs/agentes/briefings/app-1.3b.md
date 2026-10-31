# Briefing app-1.3b — Assistente de primeira vez (Convite → EULA → Pasta) (corte 2/3 do app-1.3)

BASE: 1bed24a643a89c18406b63ebfc9baee50ab5394c · RAMO: roadmap/app-1.3b · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (tela: audit e polish antes de entregar)
LEIA: qualidade-sabre §1; seguranca (segredo, rede, UAC); interface (termo técnico, confirmação, carregando); integridade (não usar o token se o convite falhar)
TRIAGEM: M5 (tela pelo molde) + M1 ; ~250 linhas com teste; risco alto (segredo, rede). Já mergeado (app-1.3a, PR #207): lerConvite (packages/nucleo/src/rede/convite.ts) e cofre safeStorage (apps/desktop/src/main/cofre.ts). Fazer SÓ o assistente: apps/desktop/src/main/boas-vindas.ts (novo) + apps/desktop/src/ui/boas-vindas.* (molde: tela Tirar PC / telas vizinhas). Passo 1 Convite: colar texto → lerConvite (formato/prazo ANTES de tudo) → gerar chave própria do PC (rede/wireguard.ts gerarChavesDoPc) → entrarNoGrupo/usarConvite (cliente.ts:~363-401) → um pedido de administrador que instala o túnel provisório, chama usar, regrava com chave própria e confirma (criarExecutorElevado/aplicarNoWindows já existem; injetar, nos testes é falso) → token no Cofre → GET /grupo (nome e endereço). Passo 2 EULA (configurar.ts perguntaEula/gerarEula; sem aceite não avança). Passo 3 Pasta-base (padrão %LOCALAPPDATA%\SabreHosting com servidor\ e mundos\), gravada em configurações. Estado "primeira vez" persistido: assistente só abre se ainda não configurou.
 NÃO ESCREVER: botão Criar convite / Validade / endereço só leitura / tirar SABRE_ENDERECO e SABRE_CARTORIO_TOKEN de deps-reais (é o app-1.3c); registrar sabre:// no Windows só se couber como função injetável testada com falso, senão deixar como melhoria; nada no cartório. Prova real do UAC/túnel no PC é P (não bloqueia; deixar no PR).
 Spec: docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md §5.2, §5.3, §6.

## Item (texto literal do roadmap, parte b)
app-1.3 (docs/roadmap-app.md): assistente de 3 passos — (1) Convite … (2) EULA … (3) Pasta-base …
*Arquivo:* apps/desktop/src/ui/boas-vindas.*, apps/desktop/src/main/boas-vindas.ts
**Tela no app:** este item é a própria tela; Configurações › Geral › "Pasta do SabreHosting".
*Confirmação:* E2E com cartório falso: convite vencido, torto ou usado → mensagem clara e nada muda; sem aceite do EULA não avança; sem cofre não guarda token; texto do convite nunca aparece no log. [P: prova real no PC Windows]

## Decisões que valem para este item
Desenho aprovado pelo Eliel em 31/10/2026 (spec). Linguagem sem termo técnico na tela (explicar "túnel" como "conexão privada com o grupo").

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.3b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois), incluindo e2e com fake (apps/desktop fake-e2e)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo, Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Tela no app:` (Configurações › Geral › Pasta do SabreHosting)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos, cartório, sync, launcher, deps-reais.ts. principal.ts: só o mínimo para abrir o assistente na primeira vez (avisar no PR; a filha do syncmel-1.12 também toca principal.ts, então mudança pequena e isolada).

## O que NÃO decidir
Qualquer mudança no fluxo do convite além do spec: pergunte à orquestradora.
