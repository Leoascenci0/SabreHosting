# Plano drive-1.2 — Tutorial: ligar o Google Drive para Computador

BASE: 50920f155d2fac401d722e753369709983ae3e86 · RAMO: roadmap/drive-1.2

## Objetivo
Escrever `docs/tutoriais/drive-historico.md`: passo a passo, em português simples, para o amigo instalar o Google Drive
para Computador e apontar o app SabreHosting para a pasta sincronizada, em Configurações › Backups.

## Passos
1. Conferir os nomes reais dos campos em `apps/desktop/src/ui/index.html` (bloco Backups) e em
   `apps/desktop/src/main/preferencias.ts`: caixa "Copiar também os backups para uma pasta", campo "Pasta do histórico
   longo", botão "Escolher pasta…", campo "Quantos guardar nesta pasta" (padrão 10, mais os dos últimos 7 dias).
2. Escrever o tutorial no estilo de `docs/tutoriais/piloto-importar.md` (termos explicados na primeira vez, tabela de
   "se der errado", sem programação).
3. Conferir o texto contra o código: pasta que some não quebra o backup local; rotação na pasta apaga também na nuvem.
4. `npm run vistoria` e PR com o modelo de `.github/pull_request_template.md`.

## Fora do escopo
Nenhuma mudança de código. A confirmação no PC (pacotes aparecendo no Drive) fica com o Eliel: P.

## Riscos
Texto que prometa algo que o app não faz. Mitigação: cada frase sobre comportamento aponta para a linha de código
conferida no PR.
