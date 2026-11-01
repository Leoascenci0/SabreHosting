# Roadmap appui — Interface do app (redesenho)

Pedido direto do Eliel (01/11/2026), depois de abrir o instalador novo: "essa interface está terrível, muito confusa e complicada; melhore muito". Sigla `appui`. Os itens mexem nos mesmos arquivos de tela, então rodam **em sequência** (um de cada vez, na ordem), não em paralelo. Cada item: skill `impeccable` (`audit` antes, `polish` depois), teste que falha antes e passa depois, captura de tela antes/depois no PR (`SABRE_CAPTURAS=1`).

## O que está ruim hoje (visto nas capturas do modo demonstração)

- **Início:** um cartão estreito (~420 px) no meio de uma janela vazia: título, uma frase e quatro botões do mesmo peso. Não mostra quem está online, o endereço para os amigos, o último backup nem o estado do servidor de forma que se entenda de relance.
- **Configurações:** uma coluna única de ~3200 px de altura com tudo junto (Geral, Servidor, Backups, Endereço, Grupo, Mods). Rótulos desalinhados dos campos, campos com larguras diferentes, textos de ajuda longos em todo campo, formulário de mod com 5 campos soltos.
- **Navegação:** cada tela é um cartão que troca o anterior; não há um lugar fixo para ir de uma área a outra, só botões "Voltar".
- **Linguagem visual:** tudo no mesmo peso; sem hierarquia entre o que é principal e o que é raro.

## Metas

Um amigo que nunca viu o app entende em 5 segundos: **o servidor está ligado? posso entrar? o que faço agora?** Nada de rolar uma tela de 3000 px para achar um campo. Termos técnicos fora da tela. Claro e escuro bons. Janela redimensionável sem quebrar.

## Itens (ordem de execução)

- [x] **1.1 — Estrutura da janela: barra lateral fixa e área de conteúdo** (PR #280)
  *O que fazer:* trocar "cartão que troca de tela" por uma estrutura fixa: barra lateral com **Início, Backups, Grupo, Configurações** (ícone + nome, item atual destacado), faixa de demonstração por cima, conteúdo à direita com largura boa (máx. ~960 px, centralizado), tamanho mínimo da janela. Atualizar `tokens.css` (escala de tipografia, espaços, sombras suaves, cores de estado: ligado/desligado/atenção) e `docs/design-system.md`. As telas atuais entram dentro da estrutura sem mudar de conteúdo ainda.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.css`, `tokens.css`, `tela.ts`, `docs/design-system.md`, testes
  **Tela no app:** barra lateral › Início / Backups / Grupo / Configurações.
  *Confirmação:* e2e: cada item da barra abre a sua tela e marca o atual; teclado (Tab/setas) navega; captura antes/depois.

- [x] **1.2 — Início como painel de controle**
  *O que fazer:* o Início mostra, de relance: **estado do servidor** grande, com cor e ícone (ligado / desligado / trocando de host / sem conexão) e uma frase simples; **endereço para os amigos** com botão Copiar; **quem está jogando** (lista ou "ninguém"); **último backup** (há quanto tempo, em palavras) e **versão do mundo**; **um botão principal** grande (Hospedar / Parar / Jogar, conforme o estado) e as ações raras (Importar mundo, Tentar de novo) como links secundários. Sem texto técnico.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.ts`, `tela.css`, `apps/desktop/src/main/inicio.ts` (só se faltar dado), testes
  **Tela no app:** Início.
  *Confirmação:* e2e por estado (parado, ligado, trocando, erro) conferindo o texto e qual botão aparece; captura antes/depois. Depende de 1.1.

- [x] **1.3 — Configurações em seções, com campos bem alinhados**
  *O que fazer:* dividir em **abas ou lista lateral interna** (Geral, Servidor, Backups) em vez de uma coluna única; cada campo com rótulo acima, campo de largura padrão, ajuda curta em uma linha (o texto longo vira "Saiba mais" que abre/fecha); campos numéricos com unidade ao lado ("minutos", "MB/s"); barra de salvar **fixa no rodapé**, com "Há alterações não salvas" e Salvar/Descartar; "Padrão" como botão por campo. Mover Grupo e Mods para telas próprias (1.4).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Configurações › Geral / Servidor / Backups.
  *Confirmação:* e2e: trocar de aba mantém o que foi digitado; salvar só habilita com mudança; valor fora do limite mostra o erro no campo; nenhuma tela passa de 1,5 altura da janela. Depende de 1.1.

- [ ] **1.4 — Grupo e Mods: telas próprias, listas limpas**
  *O que fazer:* **Grupo**: lista de PCs com nome, quando foi visto e "Tirar do grupo" (com confirmação); criar convite num painel simples (nome do PC, validade, botão Criar → texto com Copiar). **Mods**: lista com nome, versão e onde vale; "Adicionar mod" abre um formulário em passos curtos (nome, arquivo, link; hash e "onde usar" em "Avançado" recolhido). Visível só ao dono do grupo, como hoje.
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts` (extrair grupo/mods), novos `grupo.ts`/`mods.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** barra lateral › Grupo (e Grupo › Mods).
  *Confirmação:* e2e: criar convite, tirar PC (com confirmação), adicionar e tirar mod. Depende de 1.3.

- [ ] **1.5 — Backups: lista legível e ações claras**
  *O que fazer:* linhas com data em palavras ("hoje 14:32", "ontem"), tamanho e origem (automático / manual / antes de restaurar); **Fazer backup agora** em destaque; **Restaurar** com confirmação que explica que o estado atual é salvo antes; estado vazio com orientação; indicador de progresso e de "cópia na pasta extra" quando houver.
  *Arquivo:* `apps/desktop/src/ui/backups.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Backups.
  *Confirmação:* e2e: lista, estado vazio, restaurar pede confirmação e mostra progresso. Depende de 1.1.

- [ ] **1.6 — Boas-vindas e Importar como passo a passo**
  *O que fazer:* o convite vira passo a passo com indicador ("Passo 1 de 3"), uma pergunta por tela, "Explorar sem grupo" visível como alternativa, mensagens de erro com o que fazer; **Importar mundo** vira o mesmo padrão (escolher pasta → conferir o que foi achado → confirmar) em vez de painéis que aparecem no Início.
  *Arquivo:* `apps/desktop/src/ui/boas-vindas.ts`, `importar.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Boas-vindas › Passos; Início › Importar mundo.
  *Confirmação:* e2e dos fluxos existentes continuam passando; captura de cada passo. Depende de 1.2.

- [ ] **1.7 — Acabamento: estados, texto, acessibilidade e capturas**
  *O que fazer:* estados de carregando/vazio/erro em todas as telas com o mesmo visual; revisão de textos (nada de termo técnico; frases curtas); contraste e foco visível nos dois temas; redimensionar a janela de 720 a 1600 px sem quebrar; `impeccable audit` final com a lista de pendências zerada; capturas novas no README e no tutorial de teste.
  *Arquivo:* `apps/desktop/src/ui/*`, `README.md`, `docs/tutoriais/`, testes
  **Tela no app:** todas.
  *Confirmação:* e2e de redimensionamento e teste de contraste dos tokens; `audit` sem item aberto. Depende de 1.2–1.6.

## Fora deste roadmap
Launcher próprio (`lanc`), troca de host e rede: nenhuma regra do mundo muda aqui. Nada de tela nova que mande dado para fora, nem biblioteca de componentes pesada (teto de tamanho do instalador em `scripts/limites.json`).
