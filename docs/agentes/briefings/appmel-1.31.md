# Briefing appmel-1.31 — Modo demonstração: "Explorar sem grupo"

BASE: 43088f59d0daac3680802a4f2c877ec9be5eb57e · RAMO: roadmap/appmel-1.31 · MODELO: sonnet (alto risco: se falhar 2x, Opus com gatilho dito)
SKILLS: using-superpowers, qualidade-sabre, impeccable (toca tela)
LEIA: qualidade-sabre §1; references/interface.md; integridade.md (cofre/pasta real); seguranca.md (recusa no main)
TRIAGEM: M5 + M1 (+ M7 pequeno: flag de demo em memória no main) | ~220 linhas de código + ~150 de teste (histórico app-1.3b estourou 4x: subir a estimativa) | RISCO alto (recusa de Hospedar encosta no cartório; "nada gravado" no cofre e na pasta real) | MIÚDO: não
REAPROVEITAR: criarDepsE2E, depsBackupsE2E, depsImportacaoE2E, depsGrupoE2E, depsVersaoE2E, depsModsE2E (apps/desktop/src/main/fake-e2e.ts, só as peças, sem a guarda SABRE_E2E); criarBoasVindas (main/boas-vindas.ts) já deriva o passo do arquivo salvo, então "Sair da demonstração" só volta ao convite; tela-boas-vindas (ui/index.html ~l.397) e a troca de telas em ui/tela.ts; permitir/veioDaPagina (principal.ts).
NÃO ESCREVER: fake novo de cartório/cofre/backup; variável de ambiente nova; persistência do modo (fica em memória do processo); tela nova de convite; campo em Configurações; nova guarda de origem.
PASSOS: 1. flag de modo demo no main (memória, default off) e IPC sabre:bv:explorar / sabre:bv:sair-demo. 2. botão "Explorar sem grupo" e faixa "Modo demonstração" em index.html e boas-vindas.ts/tela.ts. 3. ramo do main que usa as peças falsas de fake-e2e em pasta temporária. 4. recusa "Isso é só uma demonstração" no main em Hospedar, Importar, Salvar configurações, restaurar e nos gravar de grupo/mods/versões (principal.ts, ao lado de cada permitir(evento): sabre:inicio:hospedar ~l.576, sabre:backups:restaurar ~l.583, sabre:importar:executar ~l.591, sabre:config:salvar ~l.623, grupo/mods/versões ~l.596–620). 5. não iniciar servidor de arquivos, espalhar, sincronização de mods nem a agenda de backup (criarBackupsDoApp ~l.368) em demo.
ACHADOS A VERIFICAR: (a) depsBoasVindasE2E (fake-e2e.ts ~l.308) grava boas-vindas.json em `dados` e lê SABRE_E2E_*: não usar tal qual, passar pasta temporária. (b) principal.ts usa SABRE_E2E em ~13 pontos: a demo é um modo próprio, sem mudar essas guardas. (c) no arranque real, ligarServidorDeArquivosDoApp, ligarEspalhar e modsApp.sincronizar rodam antes da boas-vindas: confirmar que sem grupo são inertes ou guardar a demo.
PROVA: e2e Electron (apps/desktop/e2e/): botão leva ao início; Hospedar/backup/importar chamados no main devolvem recusa; nada novo em userData nem no cofre (checar antes/depois); sair volta ao convite. Falha antes, passa depois.

## Item (texto literal do roadmap)
- [ ] **1.31 — Modo demonstração: "Explorar sem grupo" na boas-vindas** (decisão do Eliel, 01/11/2026)
  *O que fazer:* na tela de boas-vindas (passo do convite) um botão secundário "Explorar sem grupo" abre o app inteiro (início com os 4 botões, Backups, Configurações) com dados de mentira, sem hospedar, sem tocar no mundo e sem falar com o cartório; faixa fixa "Modo demonstração" com botão "Sair da demonstração" que volta ao convite. Reaproveitar o modo de teste/fake que já existe (`fake-e2e.ts`, item 1.2), mas sem depender de variável de ambiente; nada de dado real. O modo demonstração NÃO grava nada na pasta real do usuário nem no cofre (pasta de dados temporária ou memória). Em demonstração, Hospedar/Backup/Importar/Salvar configurações são recusados no processo principal (não só escondidos na tela) com o texto "Isso é só uma demonstração".
  *Arquivo:* `apps/desktop/src/ui/boas-vindas.ts`, `tela.ts`, `index.html`, `apps/desktop/src/main/boas-vindas-app.ts`, `principal.ts`, `fake-e2e.ts`, testes
  **Tela no app:** Boas-vindas › Passo 1 › "Explorar sem grupo"; faixa "Modo demonstração" › "Sair da demonstração".
  *Confirmação:* e2e do Electron que falha antes e passa depois (botão leva ao app completo; em demonstração hospedar/backup/importar são recusados no main e nada é gravado; sair volta ao convite); no Windows com o instalador novo **[P: Eliel]**.
  *Origem:* Eliel, ao abrir o instalador de ensaio (a tela de boas-vindas era tudo o que ele via)


## Decisões que valem para este item
Decisão do Eliel, 01/11/2026 (balão da Onda 38): modo demonstração em vez de "app completo" sem grupo. Nenhuma outra em DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.31.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em apps/desktop (unidade + e2e)
- [ ] `npm run vistoria` APROVADA (e `npm run vistoria:comum`, S-03)
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada além do texto do item. Windows real: registrar como "não confirmado (P: Eliel)".
