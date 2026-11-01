# Briefing appui-1.3 — Configurações em seções, com campos bem alinhados

BASE: 2d21d72414c3eddf12e241261306df23c2c0e8f2 · RAMO: roadmap/appui-1.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; qualidade-sabre › references/interface.md
TRIAGEM: M5 (+M1), estimativa 250 linhas, realista 500–900 com teste; risco médio→alto se passar de 300 linhas. REAPROVEITAR: validação pronta em apps/desktop/src/main/preferencias.ts:41-80 (validarIntervaloBackup, validarQuantosGuardar, validarLimiteBanda, validarHistoricoLongo) e validarDistancias (nucleo); erro por campo em ui/configuracoes.ts:114-126 (mostrarErro + aria-invalid); ocupar() :136; carregar() :523; submit :647; CSS .config em tela.css:260-375. NÃO ESCREVER: botão "Padrão" com números copiados no renderer (os padrões vêm na resposta de configuracoes.ler() pela ponte: uma fonte só; tirar os "Padrão: 10" escritos à mão em index.html); validação só na tela (a do main continua valendo); biblioteca de formulário/abas; "Padrão" para a pasta do histórico; Pasta do SabreHosting dentro do Salvar (troca tem fluxo próprio); mover Grupo/Mods (é o 1.4: aqui eles só se acomodam, sem mudar o que fazem).
PASSOS (faça em DOIS COMMITS no mesmo PR): [1.3a estrutura] ponte devolve os padrões; abas internas Geral/Servidor/Backups com os ids atuais (#cfg-*, #config-salvar, #config-erro) mantidos; rodapé fixo "Há alterações não salvas" + Salvar/Descartar; troca de aba sem recarregar; Salvar só habilita com mudança; Descartar relê só a configuração; Versão e Endereço na aba Servidor, Pasta em Geral; Grupo/Mods ficam acessíveis numa aba/seção própria até o 1.4. [1.3b campos] rótulo acima, largura padrão, ajuda curta de uma linha + "Saiba mais" (<details>), unidade ao lado, botão Padrão por campo (via ponte). ATENÇÃO: campo em aba oculta quebra o clique do Playwright, então os casos de convite/grupo/mods/versão dos e2e precisam trocar de aba antes. PROVA: configuracoes.e2e.ts estendido (troca de aba mantém o digitado; Salvar só com mudança; Descartar; Padrão restaura; erro no campo certo; tela ≤1,5× a altura da janela) + janela.e2e.ts com captura + capturas antes/depois (SABRE_CAPTURAS=1) em docs/imagens/appui-1.3/.

## Item (texto literal do roadmap)
- [ ] **1.3 — Configurações em seções, com campos bem alinhados**
  *O que fazer:* dividir em **abas ou lista lateral interna** (Geral, Servidor, Backups) em vez de uma coluna única; cada campo com rótulo acima, campo de largura padrão, ajuda curta em uma linha (o texto longo vira "Saiba mais" que abre/fecha); campos numéricos com unidade ao lado ("minutos", "MB/s"); barra de salvar **fixa no rodapé**, com "Há alterações não salvas" e Salvar/Descartar; "Padrão" como botão por campo. Mover Grupo e Mods para telas próprias (1.4).
  *Arquivo:* `apps/desktop/src/ui/configuracoes.ts`, `index.html`, `tela.css`, testes
  **Tela no app:** Configurações › Geral / Servidor / Backups.
  *Confirmação:* e2e: trocar de aba mantém o que foi digitado; salvar só habilita com mudança; valor fora do limite mostra o erro no campo; nenhuma tela passa de 1,5 altura da janela. Depende de 1.1.


## Decisões da Máxima (reversíveis)
- Um PR, dois commits (a estrutura, b campos). Onde o item diz "Grupo e Mods para telas próprias (1.4)", não mover: só garantir que continuem acessíveis.
- Versão e Endereço na aba Servidor; Pasta em Geral.

## Regras desta onda
- Só interface: nada muda em servidor, mundo, trava ou cartório; a validação de verdade continua no main. pt-BR, sem termo técnico, claro e escuro, janela redimensionável (min 720x480).
- Ficha S-19: arquivos lidos em runtime em `files` do electron-builder.json.
- PR: linhas `Tela no app:`, `Regressão:`, Triagem/Segurança/Integridade/Enxugamento/Roteamento. Rode `npm run vistoria` e `npm run vistoria:comum`; `npm ci` no próprio worktree.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] PR com as seções do modelo

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do acima.
