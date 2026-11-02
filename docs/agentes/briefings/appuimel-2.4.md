# Briefing appuimel-2.4 — Início v2: cartão principal, peças de estado, grade de números, coluna do grupo

BASE: ea8b00efc37eb8dc882263006b707d5b4df9e05a · RAMO: roadmap/appuimel-2.4 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface e enxugar), impeccable
Tela segue PRODUCT.md (raiz) e docs/design-system.md; direção v2 = bloco 2 de docs/roadmap-appui-melhoria.md (copia a ORGANIZAÇÃO de um painel de referência, nunca o visual: sem fonte monoespaçada em caixa alta, sem paleta marrom/rosa, sem ícones de bloco, sem nome/arquivo do outro produto; mantém tema claro e escuro, azul-petróleo, fonte do sistema, tudo empacotado). A captura de referência NÃO está no repo: a descrição do roadmap basta.
Launcher impeccable (de apps/desktop): /home/user/SabreHosting/.claude/skills/impeccable/scripts/impeccable context ; rode audit e polish antes de entregar e o detector uma vez no fim.
PR deve ter as linhas "Regressão:" e "Tela no app:" (S-10). Teste que falha antes e passa depois; e2e solto precisa de npm run build (S-20); npm ci no próprio worktree (S-05); capturas claro e escuro em docs/imagens/appuimel-<id>/ quando houver tela.
Não pode quebrar: regras de ouro do mundo (ninguém muda comportamento de backup/hospedar, só apresentação), confirmações existentes, teclado, janela mínima 720x480. Tetos de scripts/limites.json só descem.
Já na main: 2.1 (Direção v2 em docs/design-system.md e tokens), 2.2 (barra superior, chip #chip-estado, rodapé), 2.3 (DadosPainel com ligadoSegundos, ramReservadaMb, tamanhoMundoBytes, quantidadeBackups).
LEIA: qualidade-sabre §interface; enxugar; "Direção v2" do docs/design-system.md
TRIAGEM: M5 (+M1 para dados que a ponte já traz), ~250 linhas, risco médio (alto se o diff passar de 300 linhas: corte). Arquivos: ui/index.html (Início, main.cartao ~L62-107), tela.ts, tela.css, e2e/inicio.e2e.ts, docs/imagens/appuimel-2.4/. Reaproveitar: DadosPainel (ponte.ts:5-21; preenchido em main/inicio.ts:233-258 e principal.ts:370-385); ui/ha-quanto.ts; textoCartorio/rotuloChip (navegacao-regras.ts); copiar+aviso (tela.ts:190-195); desenharFatos (tela.ts:63-87). Jogadores e endereço já existem: só mudam de lugar e de visual. NÃO escrever: nova busca de backup, novo cálculo de tempo ligado, novo Copiar, ponte nova para jogadores/endereço, cópia do chip. Riscos e2e: inicio.e2e.ts depende de #cartao[data-estado], #status, #detalhe, #estado[data-tom], #principal/#parar/#tentar, #aviso ("Endereço copiado"), #endereco-valor, #jogadores-valor, #backup-valor, #versao-mundo-valor, #fato-endereco/#fato-jogadores, #chip-estado/#chip-texto, #pergunta, #cancelar-parar, #confirmar-parar; tela-inicial.e2e.ts usa #cartao; capturas antigas em docs/imagens/app-1.2-* e appui-1.2/. Mantenha esses ids ou atualize os testes junto SEM afrouxar asserção.

## Item (texto literal do roadmap)
- [ ] **2.4 — Início v2: cartão principal, peças de estado, grade de números, coluna do grupo**
  *O que fazer:* refazer o Início na estrutura da referência: (1) **cartão principal** com a frase de estado, versão do
  Minecraft, tempo ligado e jogadores; (2) **três peças** pequenas com borda de estado: "Este PC", "Servidor", "Grupo"
  (cartório); (3) **ações** (Jogar, Hospedar, Parar…) logo abaixo, uma principal por vez; (4) **grade de números**
  (jogadores, RAM, tamanho do mundo, backups, último backup "há quanto tempo") com a comparação ao lado; (5) **coluna
  lateral** "Quem está online" e "Endereço para os amigos" com botão Copiar. Estados vazios honestos; sem número inventado.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tela.ts`, `docs/design-system.md`, e2e, capturas
  **Tela no app:** Início.
  *Confirmação:* e2e (cada estado: ninguém hospeda, eu hospedo, outro hospeda, sem cartório, demonstração); capturas
  claro e escuro em `docs/imagens/appuimel-2.4/`.
  *Depende de:* 2.2, 2.3

## Decisões que valem para este item (Máxima, reversíveis; liste em "Decidi por você" no PR)
- Versão do Minecraft: acrescente o campo opcional versaoMinecraft em DadosPainel (lida de lerConfigGrupo().versaoMinecraft em principal.ts:~567, ~10 linhas em inicio.ts/ponte.ts/principal.ts) com teste de unidade (ausente = campo não existe). Sem ele o cartão principal mostra "—".
- RAM: acrescente totalMemMb opcional (os.totalmem() em MB, só leitura, sem dependência) para a grade dizer "RAM reservada: 4 GB de 16 GB do PC". Rótulo "reservada", nunca "usada".
- "Era X" só existe onde há valor anterior de verdade. Onde não houver (tamanho do mundo, RAM), a comparação é contexto real (ex.: "de 16 GB do PC"; "último backup há 2 h"; "N backups guardados") ou "—" com dica. NUNCA número inventado nem valor anterior fabricado.
- Tempo ligado só quando EU hospedo; para outro PC mostra "—" com dica "só quem hospeda sabe".
- Peça "Grupo" = estado do cartório (textoCartorio); peça "Servidor" = estado do servidor; peça "Este PC" = o PC (nome e se tem a trava/pode hospedar), cada uma com borda de estado + ícone + palavra.
- Atualização por intervalo curto só com a tela do Início visível (2.3 só entrega o dado); use o evento existente "sabre:inicio:mudou" e, se precisar de intervalo, pare-o ao sair do Início e com a janela oculta.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appuimel-2.4.md como primeiro commit
- [ ] e2e para os 5 estados (ninguém hospeda, eu hospedo, outro hospeda, sem cartório, demonstração), sem afrouxar os existentes; janela 720x480 sem rolagem horizontal
- [ ] Capturas claro e escuro em docs/imagens/appuimel-2.4/ (npm run build antes, S-20)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Backups/Grupo/Configurações (2.5/2.6). Comportamento de hospedar/backup não muda.

## O que NÃO decidir
Nada.
