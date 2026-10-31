# Bom-dia

_Reescrito pela coordenadora da Máxima em 31/10/2026, 19:05 (Ondas 26–31). Estado: `docs/ops/rodadas/coordenacao-2026-10-31b.md`._

- **O que entrou à tarde (Ondas 26–31, ~28 PRs, vistoria APROVADA na `main` a cada onda):**
  - **Convite e primeira vez no app:** assistente de entrada, Criar convite (acessível), cofre do token com aviso de corrompido, pasta do SabreHosting.
  - **Jogar:** botão Jogar abre o jogo já conectado (Prism), mods do grupo iguais para todos e tela de mods.
  - **Mundo:** espalhar a versão nova ligado ao app, quem voltou depois de muito tempo atualiza, servir só pacote fechado (link simbólico barrado).
  - **Host:** Hospedar recusa sem o túnel privado; `server.properties` só depois da trava e servidor órfão recusado; distâncias de visão ligadas.
- **Decidi por você** (reversíveis, com PR): Hospedar sem túnel recusa (#228); app empacotado ignora SABRE_JAVA/SABRE_NEOFORGE (#225);
  trocar a pasta só avisa onde o mundo antigo ficou (#219); app-1.3 cortado em a/b/c; banda/limites de ontem seguem.
- **Esperando você:**
  1. **appmel-1.14a** — o cartório pode reemitir o pacote da conexão a quem já gastou o token (retomar sem convite novo)? Decisão de segurança.
  2. **Liberar `repo.papermc.io` e `maven.neoforged.net`** (ainda 403 às 15:13): destrava rede-2.2, migra-2.2/2.3/3.1 e mods na 1.20.1.
  3. **Provas no PC Windows:** assistente/UAC/túnel, Criar convite com cartório real, Prism abre o jogo, cofre `safeStorage`, leitor de tela, backup com level-name trocado.
  4. **Importar o mundo real** (`docs/tutoriais/piloto-importar.md`); D9 (assinatura) quando chegar o app-3.2.
- **Custo:** ondas e filhas da tarde não medidas (sessões de onda US$ 0,5–2,3 cada).
- **O que não foi verificado:** nada rodou num PC Windows nem na nuvem de verdade; Onda 29 sem `qa` separado (revisão por diff + vistoria).
