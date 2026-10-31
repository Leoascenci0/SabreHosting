# Briefing app-1.3c-i — Endereço do cartório, pasta-base e abrirJogo em deps-reais

BASE: 5b50d644b990e7a548dbe1e5b2fea671c744f798 · RAMO: roadmap/app-1.3c-i · MODELO: sonnet (gatilho Opus: nenhum)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1, integridade, seguranca
TRIAGEM: M1+M5 (corte 1.3c-i). Reaproveitar: deps-reais.ts:61,87,111 (hoje lê SABRE_ENDERECO/SABRE_CARTORIO_TOKEN/SABRE_PASTA_* do ambiente), boas-vindas.ts:37,217 (pastaBase), services/cartorio/src/servidor.ts:316 (GET /grupo já existe), rede/convite.ts, cofre.ts, abrir.ts:45-71. NÃO escrever: parser de convite, cofre, endpoint /grupo, validação de id do abrirJogo. Risco alto (token/cofre/rede). Estimativas passadas estouraram 4x: fique no corte.

## Item (corte 1.3c-i de docs/roadmap-app.md 1.3 + appmel-1.4 + lancmel-2.2)
1) deps-reais.ts deixa de ler SABRE_ENDERECO e SABRE_CARTORIO_TOKEN do ambiente: endereço do cartório e token vêm da configuração gravada pela entrada no grupo (boas-vindas/entrada-no-grupo) e do cofre real; endereço do Jogar vem de GET /grupo (appmel-1.4); Configurações › Grupo › "Endereço do servidor" (só leitura, vindo do cartório).
2) A pasta-base gravada pelo assistente (pastaBase em boas-vindas.json) alimenta onde servidor e mundos são lidos (hoje SABRE_PASTA_*; padrão %LOCALAPPDATA%\SabreHosting com servidor\ e mundos\).
3) lancmel-2.2: ligar abrirJogo em depsReais com detectarPrism, id da instância e endereço do grupo; derivar pastaMarcador e idInstancia da MESMA instância (ids que não combinam são recusados; teste). Ver docs/roadmap-lanc-melhoria.md 2.2. Se a lancmel-2.1 (já mergeada, mods-grupo.ts) espera SABRE_PASTA_MODS_INSTANCIA, ligue-o à pasta da instância.
Arquivos: apps/desktop/src/main/deps-reais.ts (+teste), boas-vindas.ts/entrada-no-grupo.ts se preciso, packages/nucleo/src/launcher/abrir.ts, ui de Configurações › Grupo para o campo só leitura.
FORA deste corte (será o 1.3c-ii): botão "Criar convite"/Validade.
Variáveis de ambiente podem continuar como sobreposição só em modo teste/e2e (fake-e2e), nunca como caminho normal.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.3c-i.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); prova de que sem SABRE_ENDERECO/TOKEN no ambiente o app funciona a partir da config+cofre
- [ ] npm run vistoria APROVADA; PR com Tela no app:, Regressão: e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; provas no Windows como [P]
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Regra do grupo; dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).
