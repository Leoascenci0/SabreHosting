# Briefing appmel-1.1 — Ícone próprio para a bandeja

BASE: 0966655c5da7c2d75f786b89349e81b30f0299d3 · RAMO: roadmap/appmel-1.1 · MODELO: sonnet (gatilho Opus: nenhum) · ISSUE: #142
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1, §interface; impeccable (audit)
TRIAGEM (Máxima): M7 pequeno | ~10 linhas de código + 3 PNG | RISCO baixo | FERRAMENTAS: /usr/bin/convert (ImageMagick) e Python PIL existem na sessão; nenhuma dependência nova no projeto | PASSOS: 1. a partir de apps/desktop/recursos/icone/ (o ícone do Eliel, D4), recortar só a cabeça do tigre (quadrado, sem o texto), gerar bandeja-16.png, bandeja-24.png, bandeja-32.png (e @2x/48 se o Electron usar para 150%: 32 e 48) com fundo transparente e nitidez boa (redução com filtro adequado; conferir à vista); 2. principal.ts usa o recorte na bandeja (nativeImage com as resoluções; no Windows o Tray escolhe pela escala); 3. o script/comando usado para gerar fica documentado (ex. infra não, um LEIAME curto em recursos/icone/) para refazer; 4. mostrar as 3 imagens no PR (anexar ou caminho) | NÃO ESCREVER: mudar o ícone da janela/instalador; editar o desenho do Eliel | PROVA: E2E/teste que a bandeja carrega o arquivo novo (se houver gancho); vistoria APROVADA; conferência no Windows 100%/150% = [P] do Eliel (passo a passo no PR).

## Item (texto literal do roadmap)
- [ ] **1.1 — Ícone próprio para a bandeja**
  *O que fazer:* recortar só a cabeça do tigre do ícone (o texto "SABRE HOSTING" não se lê em 16–32 px) e usar esse
  recorte na bandeja, nos tamanhos 16, 24 e 32 px.
  *Arquivo:* `apps/desktop/recursos/icone/`, `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* no Windows, com escala 100% e 150%, o ícone da bandeja aparece nítido.
  *Origem:* app-1.1 · PR #70 · filha · **confirmado pelo Eliel no Windows (31/10): na bandeja o ícone fica pequeno e o
  texto não se lê.**

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) — ou, no ícone, as imagens geradas e mostradas no PR
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #142) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar PNG de captura), máquina da nuvem real, segredo. Só apps/desktop/recursos/icone/ e apps/desktop/src/main/principal.ts.

## O que NÃO decidir (perguntar à orquestradora)
nada
