# Briefing appui-1.2 — Início como painel de controle

BASE: 582dd0a3ab1879801386d08af426f92a2b1528ce · RAMO: roadmap/appui-1.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre (interface), impeccable (audit antes, polish depois)
LEIA: docs/roadmap-appui.md inteiro; docs/design-system.md; qualidade-sabre › references/interface.md
TRIAGEM: M5 (+M1), ~300 linhas (real provável 500–800), risco médio. REAPROVEITAR: backups.listar (ponte.ts:155; deps-backups.ts devolve criadoEm); list() de jogadores (packages/nucleo/src/servidor/comandos.ts:105); deps.copiar em inicio.ts; botões principal/parar/tentar já existem em index.html e tela.ts; versao.lerAtual (main/versao.ts). NÃO ESCREVER: botão principal novo, cópia de endereço nova, leitura nova de backups, estado "trocando de host" de migração (não existe), formatador de "há X tempo" se já houver. PASSOS: (1) inicio.ts ganha campos opcionais (ultimoBackup, jogadores, versaoMundo) + deps opcionais; (2) principal.ts liga as deps; (3) index.html/tela.ts/tela.css: painel; (4) e2e por estado. PROVA: inicio.test.ts casos novos (jogadores 0/2, backup ausente, sem dado = não mostra) + inicio.e2e.ts (parado, ligado, trocando via atualizando/trocandoVersao/restaurando, erro) + tela-inicial.e2e.ts + janela.e2e.ts continuam passando + capturas antes/depois (SABRE_CAPTURAS=1).

## Item (texto literal do roadmap)
- [ ] **1.2 — Início como painel de controle**
  *O que fazer:* o Início mostra, de relance: **estado do servidor** grande, com cor e ícone (ligado / desligado / trocando de host / sem conexão) e uma frase simples; **endereço para os amigos** com botão Copiar; **quem está jogando** (lista ou "ninguém"); **último backup** (há quanto tempo, em palavras) e **versão do mundo**; **um botão principal** grande (Hospedar / Parar / Jogar, conforme o estado) e as ações raras (Importar mundo, Tentar de novo) como links secundários. Sem texto técnico.
  *Arquivo:* `apps/desktop/src/ui/index.html`, `tela.ts`, `tela.css`, `apps/desktop/src/main/inicio.ts` (só se faltar dado), testes
  **Tela no app:** Início.
  *Confirmação:* e2e por estado (parado, ligado, trocando, erro) conferindo o texto e qual botão aparece; captura antes/depois. Depende de 1.1.


## Decisões da Máxima para este item (reversíveis, "decidi por você")
1. "Versão do mundo" = o número de versão do mundo que o app já conhece (versaoNoGrupo / cartório, como já usado em importar.ts), em palavras simples ("versão 12 do mundo"); se o app não tiver o dado (modo demonstração/sem grupo), a linha não aparece. Não é a versão do Minecraft.
2. "Quem está jogando": só quando o servidor roda neste PC (list() do núcleo). Quando outro PC hospeda, mostrar "Quem está hospedando: <nome do PC>" se o dado já existir, e "Não dá para ver quem está jogando daqui" — sem pedir nada novo ao cartório.
3. "Trocando de host": usar só os estados que já existem (atualizando, trocandoVersao, restaurando) mais "sem conexão" e erro; nenhum estado novo de migração.

## Regras desta onda
- Só interface: nada muda em servidor, mundo, trava ou cartório (ler dados já disponíveis é ok; não criar chamada nova ao cartório). pt-BR, sem termo técnico, claro e escuro, janela redimensionável (min 720x480).
- Ficha S-19: arquivos lidos em runtime em `files` do electron-builder.json.
- Linhas no PR: `Tela no app:`, `Regressão:`, Triagem/Segurança/Integridade/Enxugamento/Roteamento. Rode `npm run vistoria` e `npm run vistoria:comum`; `npm ci` no próprio worktree. Capturas antes/depois no PR (docs/imagens/appui-1.2/).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appui-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] vistoria e vistoria:comum APROVADAS
- [ ] PR com as seções do modelo

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada além do acima.
