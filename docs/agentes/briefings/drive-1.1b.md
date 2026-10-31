# Briefing drive-1.1b — Rotação na pasta sincronizada

BASE: 4dd08dee84bd5fd4b618490dabe2d3df1bc030de · RAMO: roadmap/drive-1.1b · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (campo da tela)
LEIA: qualidade-sabre §integridade (regras 3 e 4), §seguranca (S-07), §interface, §enxugar
TRIAGEM: M1+M2, ~70 linhas + ~120 teste, risco ALTO (apaga backup; a pasta sincroniza a exclusão para a nuvem).
REAPROVEITAR (já na main, PR #179): packages/nucleo/src/backup/rotacao-pasta.ts rotacionarPasta(pasta, {recentes, agora}) :97 (lê marcas, planeja, reconfere o bom, apaga) e marcarBackup :66; apps/desktop/src/main/rotacao-backups.ts criarRotacaoBackups :22; main/agenda-backups.ts copiarAoConcluir (já chama copiarParaPasta, nunca propaga erro); main/preferencias.ts QUANTOS_GUARDAR_PADRAO/MAX.
NÃO ESCREVER: planejador novo nem regra '1 por dia/30 dias, 1 por semana/1 ano' (texto antigo do roadmap; vale a decisão 10 + tudo dos últimos 7 dias, já em planejarRotacao); conferência de hash nova; cópia própria; marcas escritas à mão; rotacionar a pasta de backups locais pela pasta do Drive; mexer na rotação local.
PASSOS: (1) CORRIGIR ANTES de ligar (achado do qa do #179): conferirEMarcar/rotacionarPasta marca 'ruim' em QUALQUER falha de conferir; falha de I/O (Drive ainda baixando, disco cheio) NÃO pode marcar 'ruim' — só marcar quando o hash ou o manifesto não bater; erro de I/O fica sem marca (nunca apagável). Teste que falha antes (vale também para a rotação local). Também: preferencias.ts lê quantosGuardar com Number() e aceita true/"5"/[3]; exija typeof === 'number' (teste). (2) depois de copiarParaPasta, marcarBackup('bom') no pacote copiado SÓ com o sha conferido, e rotacionarPasta SÓ na pasta do histórico; (3) campo 'Quantos guardar nesta pasta' (padrão 10, validado como o outro) em Configurações › Backups › Histórico longo numa pasta; (4) erro da rotação (pasta sumiu, lista torta) vira aviso e NUNCA derruba o backup local nem apaga nada; apaga só arquivos com nome padrão do Sabre, lstat, links e pastas pulados (S-07). S-06: sem duas rotações ao mesmo tempo (geração antes de await).
PROVA (mundo inventado): teste 'pasta some no meio': backup local fica salvo e a rotação não apaga nada; 'não apaga o que não é do Sabre'; 'último bom sobrevive'; campo com 0 recusado; I/O falho não marca ruim.

## Item (texto literal do roadmap)
- [ ] **1.1 — Destino "pasta sincronizada"** *(corte de 31/10: 1.1a feito no PR #174 — copia o pacote fechado, botão "Escolher pasta…", sem apagar nada; resta 1.1b ⏸️ P: a rotação na pasta apaga backups e pede o OK do Eliel, junto com o appmel-1.11)*
  *O que fazer:* copiar pacotes fechados para uma pasta escolhida (qualquer serviço que sincronize pasta: Drive,
  OneDrive, Dropbox), escrevendo com nome temporário e renomeando no fim; rotação própria (1 por dia/30 dias,
  1 por semana/1 ano).
  *Arquivo:* `packages/nucleo/src/backup/destinos/pasta.ts`
  **Tela no app:** Configurações › Backups › "Histórico longo numa pasta" (liga, pasta, rotação).
  *Confirmação:* teste: pasta que some no meio não quebra o backup local.
  *Depende de:* bkp-2.1, app-2.2

## Decisões que valem para este item
- 31/10 (Eliel): rotação ligada, 10 mais novos + tudo dos últimos 7 dias; nunca apaga o último bom; configurável.
- 31/10 (Máxima, reversível): drive-1.1b segue a mesma regra 10 + 7 dias. Aviso na tela, em uma frase: apagar na pasta também apaga na nuvem do serviço sincronizado.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/drive-1.1b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Mudar o padrão 10 ou o mínimo garantido.
