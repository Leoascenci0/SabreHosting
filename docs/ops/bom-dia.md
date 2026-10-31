# Bom-dia

_Reescrito pela Máxima no fim de cada onda, ao pausar e no encerramento. Atualizado em 31/10/2026, 22:15 (fim da leva app-1.1/cartório)._

- **O que entrou nesta leva (5 PRs):**
  - App: janela única com ícone na bandeja e design claro/escuro (#70); tela inicial com Jogar / Hospedar / Parar nos
    4 estados, e "Sair" que para o servidor e devolve a vez antes de fechar (#74). Imagens em `docs/imagens/app-1.*`.
  - Cartório: aceita só a rede privada, recusa mensagem grande, bloqueia 20 tentativas erradas (#69); banco numa pasta
    de dados (#69); senha de administrador num arquivo protegido criado pelo instalador (#75).
  - Base: teste da trava estável com a máquina ocupada (#76).
- **Tutoriais para testar:** `docs/tutoriais/2026-10-31-app-demonstracao.md` — abrir as telas do app no Windows em modo demonstração (dados de mentira; o instalador vem no app-3.1).
- **Decidi por você:** Jogar só copia o endereço (abrir o Prism é do lanc-1.3); Parar e Sair pedem confirmação; cartório
  recusa a faixa de operadora 100.64/10; convites não usados somem 7 dias depois de vencer; "Abrir com o Windows" vem
  desligado; 3ª passada no app-1.2 (exceção à regra de 2 devoluções, por ser regra de ouro 1).
- **Esperando você:**
  1. Liberar `repo.papermc.io` na rede do ambiente (menu do ambiente › Edit › Network access › Allowed domains, com
     "Allow package managers" marcado) — destrava o rede-2.2 (porteiro do proxy e lista de quem entra).
  2. Aprovar o desenho do convite (app-1.3): vou levar a proposta em balão.
  3. Os de antes: proteção da `main` e rótulos; versão do Minecraft/NeoForge; criar a máquina Oracle; D9.
- **Custo:** filhas desta leva US$ 6,64 (5 sessões; a mais cara: cartório em Opus, US$ 2,50). Revisões `qa` não
  registradas.
- **O que não foi verificado:** nada rodou num PC Windows (bandeja, "Abrir com o Windows", ícone de 32 px); o app só
  usou cartório e Minecraft falsos; o instalador da nuvem só em simulação; a vistoria regrava as imagens do app-1.1
  (appmel-1.3).
