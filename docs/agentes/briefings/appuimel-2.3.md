# Briefing appuimel-2.3 — Dados do Início na ponte

BASE: 7fb0ea425f164221e2b93de60cc1e1110a87887e · RAMO: roadmap/appuimel-2.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar; integridade só onde tocar backup/mundo), impeccable
Tela segue PRODUCT.md (raiz) e docs/design-system.md; direção v2 = bloco 2 de docs/roadmap-appui-melhoria.md (copia a ORGANIZAÇÃO de um painel de referência, nunca o visual: sem fonte monoespaçada em caixa alta, sem paleta marrom/rosa, sem ícones de bloco, sem nome/arquivo do outro produto; mantém tema claro e escuro, azul-petróleo, fonte do sistema, tudo empacotado). A captura de referência NÃO está no repo: a descrição do roadmap basta.
Launcher impeccable (de apps/desktop): /home/user/SabreHosting/.claude/skills/impeccable/scripts/impeccable context ; rode audit e polish antes de entregar e o detector uma vez no fim.
PR deve ter as linhas "Regressão:" e "Tela no app:" (S-10). Teste que falha antes e passa depois; e2e solto precisa de npm run build (S-20); npm ci no próprio worktree (S-05); capturas claro e escuro em docs/imagens/appuimel-<id>/ quando houver tela.
Não pode quebrar: regras de ouro do mundo (ninguém muda comportamento de backup/hospedar, só apresentação), confirmações existentes, teclado, janela mínima 720x480. Tetos de scripts/limites.json só descem.
LEIA: qualidade-sabre §desempenho (ler sem carregar o mundo na RAM) e §integridade (só leitura, nada de apagar)
TRIAGEM: M1 (reaproveitar listarJogadores, listarBackups, ultimoBackup, DadosPainel) + M7 pequeno (tamanho do mundo), ~110 linhas, risco médio. Reaproveitar: apps/desktop/src/main/principal.ts:357-371 (ultimoBackup/jogadores já ligados ao criarInicio); main/inicio.ts:105-125 (DadosPainel); packages/nucleo/src/backup/listar.ts listarBackups (uma chamada só, .length e o último); nucleo/src/servidor/comandos.ts list(); main/config-pc.ts:62 caminho do mundo; ui/ponte.ts DadosPainel (só acrescentar campos opcionais). preload.cts provavelmente não muda (inicio.estado devolve o objeto inteiro). NÃO escrever: canal IPC novo; nova lista de jogadores; timer no main (atualização é por evento "sabre:inicio:mudou"; o intervalo só com a tela aberta é do 2.4). Passos: (1) tempo ligado: guardar Date.now() ao hospedar e devolver quando "eu" hospedo; (2) quantidade de backups; (3) tamanho do mundo: soma de stat dos arquivos (sem ler conteúdo), cache curto; (4) memória; (5) campos opcionais em DadosPainel e fake-e2e.ts.

## Item (texto literal do roadmap)
- [ ] **2.3 — Dados do Início na ponte: jogadores, tempo ligado, RAM, tamanho do mundo**
  *O que fazer:* o main passa a entregar para a tela, pela ponte e já pronto para mostrar: jogadores online (número e nomes),
  tempo ligado, memória usada pelo servidor (quando ligado), tamanho do mundo no disco (leitura barata, sem ler o mundo
  inteiro na RAM) e quantidade/último backup. Dado que não existe volta `null` (a tela mostra "—"). Atualização por
  intervalo curto só com a tela aberta. Nada novo aberto na rede.
  *Arquivo:* `apps/desktop/src/main/inicio.ts` (ou vizinho), `ponte.ts`, `preload.cts`, `fake-e2e.ts`, testes
  **Tela no app:** não se aplica (alimenta o 2.4).
  *Confirmação:* teste de unidade do main (cada campo, ausente = `null`); mundo de teste inventado.
  *Depende de:* nada

## Decisões que valem para este item (tomadas pela Máxima, reversíveis; liste em "Decidi por você" no PR)
- "Não existe" = campo ausente (undefined), como o resto de DadosPainel; a tela mostra "—". Não troque para null.
- Memória: use a RAM reservada que já existe (ramMb) rotulada como "reservada", SEM medir o processo e SEM dependência nova (medir de verdade no Windows pede método próprio; vai para "Melhorias encontradas").
- Nada novo aberto na rede.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.3.md como primeiro commit
- [ ] inicio.test.ts (ou vizinho): cada campo ausente = não existe, com valor = aparece; mundo de teste inventado em tests/mundos/
- [ ] `npm run vistoria` APROVADA (e vistoria:comum se mexer em infra)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app (não se aplica)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Não mexer em index.html/tela.css/tela.ts (2.2 e 2.4).

## O que NÃO decidir
Nada.
