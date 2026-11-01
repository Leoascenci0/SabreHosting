# Briefing appui-1.7 — Acabamento: estados, texto, acessibilidade e capturas

BASE: a75373fb6ec1f80f2e06f360d77d1292d3bd0f6b · RAMO: roadmap/appui-1.7 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface), impeccable (audit COMPLETO no início e no fim)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; docs/ops/rodadas/onda-2026-11-01-41.md e onda-2026-11-01-42.md (achados); docs/tutoriais/2026-11-01-ensaio-instalador.md; README.md.
TRIAGEM: M1/M5, acabamento: nada de tela nova nem biblioteca; ajustes nos arquivos de apps/desktop/src/ui, testes e docs. Risco baixo (só interface).

## Item (texto literal do roadmap)
- [ ] **1.7 — Acabamento: estados, texto, acessibilidade e capturas**
  *O que fazer:* estados de carregando/vazio/erro em todas as telas com o mesmo visual; revisão de textos (nada de termo técnico; frases curtas); contraste e foco visível nos dois temas; redimensionar a janela de 720 a 1600 px sem quebrar; `impeccable audit` final com a lista de pendências zerada; capturas novas no README e no tutorial de teste.
  *Arquivo:* `apps/desktop/src/ui/*`, `README.md`, `docs/tutoriais/`, testes
  **Tela no app:** todas.
  *Confirmação:* e2e de redimensionamento e teste de contraste dos tokens; `audit` sem item aberto. Depende de 1.2–1.6.

## Revise TODAS as telas
Início, Backups, Grupo, Mods, Configurações (Geral/Servidor/Backups), Boas-vindas (3 passos), Importar (3 passos), modo demonstração: claro e escuro, janela de 720 a 1600 px, só teclado (Tab/setas/Enter/Esc, foco visível), leitor de tela (um título por tela, aria-live nos erros, aria-busy no carregando), textos em pt-BR sem termo técnico (hash, token, IPC, jar, etc.), mesmo visual de carregando/vazio/erro.

## Lista de achados das ondas 41 e 42 a FECHAR (ou registrar por que ficou)
1. "Salvo." em Configurações não some ao voltar a editar (1.3).
2. Enter no campo do convite (Boas-vindas) não confirma: `#bv-convite-form` não é `<form>` (1.6).
3. `voltar.focus()` em botão escondido (Backups) não faz nada: tirar ou corrigir (1.5).
4. Barra de progresso de Backups testada só pelo atributo `hidden`: reforçar o teste se der.
5. e2e instável 1x no 1.1: vigie; se repetir, ficha em docs/memoria/solucoes.md SÓ SE a sessão de onda pedir (você descreve na seção "Soluções" do PR).
6. NÃO faça (precisa de ponte/main, fica fora; liste em "Melhorias encontradas" no formato de item): "visto há quanto tempo" do PC no Grupo; "Fazer backup agora" e origem do backup (⏸️ P do Eliel).
Complete a lista com o que o `audit` achar; cada achado fica "feito" ou "registrado no PR com o porquê". Pendência aberta no fim = justifique.

## Regras
- Só interface e docs: nada muda em servidor, mundo, trava ou cartório; sem IPC nova. Cuidado com contraste dos tokens (teste que calcula a razão dos pares texto/fundo nos dois temas, mínimo 4,5:1 para texto normal).
- E2E de redimensionamento: janela em 720, 1024, 1600 de largura, sem rolagem horizontal nem corte nas telas principais.
- Capturas novas (SABRE_CAPTURAS=1) em docs/imagens/appui-1.7/; usar no README (seção do app) e no tutorial de teste docs/tutoriais/2026-11-01-ensaio-instalador.md (atualizar o texto "Início com os 4 botões" etc. para a interface nova: barra lateral, Início painel, Configurações em abas, Backups, Grupo, passo a passo). Os tetos de scripts/limites.json não podem subir (imagens ficam em docs/, fora do instalador).
- S-19: arquivo lido em runtime fora de dist/ em `files` do electron-builder.json.
- PR: `Tela no app:`, `Regressão:`, Triagem/Segurança/Integridade/Enxugamento/Roteamento; `Refs #n` com número (abra a issue). `npm run vistoria` e `npm run vistoria:comum` (uma de cada vez); `npm ci` no próprio worktree.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.7.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] audit final: lista acima zerada ou justificada, no PR

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.
