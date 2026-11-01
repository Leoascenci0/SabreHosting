# Bom-dia

_Reescrito pela coordenadora da Máxima em 31/10/2026, 19:25 (Ondas 26–33). Estado: `docs/ops/rodadas/coordenacao-2026-10-31b.md`._

- **O que entrou à tarde (Ondas 26–31, ~28 PRs, vistoria APROVADA na `main` a cada onda):**
  - **Convite e primeira vez no app:** assistente de entrada, Criar convite (acessível), cofre do token com aviso de corrompido, pasta do SabreHosting.
  - **Jogar:** botão Jogar abre o jogo já conectado (Prism), mods do grupo iguais para todos e tela de mods.
  - **Mundo:** espalhar a versão nova ligado ao app, quem voltou depois de muito tempo atualiza, servir só pacote fechado (link simbólico barrado).
  - **Host:** Hospedar recusa sem o túnel privado; `server.properties` só depois da trava e servidor órfão recusado; distâncias de visão ligadas.
  - **Madrugada (Onda 33):** `npm run vistoria:comum` (testa como usuário comum), vigia fora do `app.asar`, download de mod com zip recusado se suspeito, ajustes de cartório e host.
  - **Também (Onda 32):** restaurar backup relê o level-name (#238); tutorial do Drive (#239); montar a versão do jogo com download simulado (#240); configuração do instalador Windows (#241).
- **Decidi por você** (reversíveis, com PR): Hospedar sem túnel recusa (#228); app empacotado ignora SABRE_JAVA/SABRE_NEOFORGE (#225);
  trocar a pasta só avisa onde o mundo antigo ficou (#219); app-1.3 cortado em a/b/c; banda/limites de ontem seguem.
- **Esperando você:**
  1. **appmel-1.14a** — o cartório pode reemitir o pacote da conexão a quem já gastou o token (retomar sem convite novo)? Decisão de segurança.
  2. **Liberar `repo.papermc.io` e `maven.neoforged.net`** (ainda 403 às 15:13): destrava rede-2.2, migra-2.2/2.3/3.1 e mods na 1.20.1.
  3. **Provas no PC Windows:** assistente/UAC/túnel, Criar convite com cartório real, Prism abre o jogo, cofre `safeStorage`, leitor de tela, backup com level-name trocado.
  4. **Testes no PC (Onda 32):** versão real do jogo + extração do Java (lanc-2.3), tutorial do Drive (drive-1.2), primeira tag/instalação no Windows (app-3.1; subir a versão 0.0.0 antes da 1ª tag).
  5. **Importar o mundo real** (`docs/tutoriais/piloto-importar.md`); D9 (assinatura) quando chegar o app-3.2.
- **Custo:** ondas e filhas da tarde não medidas (sessões de onda US$ 0,5–2,3 cada).
- **O que não foi verificado:** nada rodou num PC Windows nem na nuvem de verdade; Onda 29 sem `qa` separado (revisão por diff + vistoria).
- **Fila sem P quase vazia (00:05).** Só sobra appmel-1.23 (precisa do GitHub Actions). Tudo que sobra espera você (appmel-1.14a, D9/app-3.2, lanc-2.2), os domínios bloqueados (rede-2.2, migra-2.x, redemel-2.2/2.3) ou o Windows/nuvem reais.

- **Onda 34 (01/11, madrugada):** lancmel-2.8 #252 — o `javaw` do Java baixado só é reaproveitado se tamanho e sha256 baterem com o extraído. Melhorias dos PRs #244–#250 consolidadas: nenhuma nova além desta. Fila sem P vazia; só sobra appmel-1.23 (precisa rodar o GitHub Actions) e o que espera você.

- **01/11, manhã (Ondas 35–36):** "Tentar de novo" no convite, válido por 30 min no mesmo PC (#257, sua decisão); ensaio do instalador (#259, #261); Electron fixado (#263). **Ensaio do instalador rodou no GitHub com sucesso:** 116,6 MiB, teto 120 MiB (folga de ~3 MiB). Ainda não instalado num Windows.
  Decidi por você: "Tentar de novo" só com o app aberto (chave só em memória, #257).

- **01/11, tarde (Onda 38):** tela inicial agora mostra Hospedar, Importar mundo, Backups e Configurações em grade 2×2, sem rolar (#267); aviso falso "Atenção com o mundo" corrigido (#268). **Teste:** instale o instalador NOVO (tutorial `docs/tutoriais/2026-11-01-ensaio-instalador.md`). Não visto num Windows de verdade. Backlog: appmel-1.29.

- **01/11, noite (Onda 39):** o instalador de ensaio instalava mas não abria (ícones da bandeja fora do pacote; o erro matava o arranque). Corrigido e testado empacotando e abrindo (#272). **Instalador novo:** https://github.com/Leoascenci0/SabreHosting/actions/runs/41342283125 (artefato `instalador-ensaio`, ~117 MB; tutorial `docs/tutoriais/2026-11-01-ensaio-instalador.md`). Só visto em Linux; falta o seu teste no Windows.
