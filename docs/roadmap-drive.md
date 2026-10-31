# Roadmap — Drive (histórico longo opcional)

Objetivo: quem quiser (o Eliel, que paga o Google Drive) guarda um histórico longo de backups numa pasta sincronizada
pelo **Google Drive para Computador**, sem API. Opcional e desligado por padrão.

**Sigla `drive`.** Ramos `roadmap/drive-<id>`. Código em `packages/nucleo/src/backup/destinos/`. Nunca a pasta do mundo
ao vivo: só pacotes fechados.

- [x] **1.1 — Destino "pasta sincronizada"** (1.1b ✅ PR #181, 31/10/2026: rotação 10 + 7 dias na pasta) *(corte de 31/10: 1.1a feito no PR #174 — copia o pacote fechado, botão "Escolher pasta…", sem apagar nada; resta 1.1b ⏸️ P: a rotação na pasta apaga backups e pede o OK do Eliel, junto com o appmel-1.11)*
  *O que fazer:* copiar pacotes fechados para uma pasta escolhida (qualquer serviço que sincronize pasta: Drive,
  OneDrive, Dropbox), escrevendo com nome temporário e renomeando no fim; rotação própria (1 por dia/30 dias,
  1 por semana/1 ano).
  *Arquivo:* `packages/nucleo/src/backup/destinos/pasta.ts`
  **Tela no app:** Configurações › Backups › "Histórico longo numa pasta" (liga, pasta, rotação).
  *Confirmação:* teste: pasta que some no meio não quebra o backup local.
  *Depende de:* bkp-2.1, app-2.2

- [ ] **1.2 — Tutorial: ligar o Google Drive para Computador**
  *O que fazer:* passo a passo para instalar o Drive para Computador e apontar o app para a pasta.
  *Arquivo:* `docs/tutoriais/drive-historico.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel vê os pacotes aparecendo no Drive. **[P: teste no PC]**
  *Depende de:* drive-1.1
