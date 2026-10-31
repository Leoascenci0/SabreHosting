# Bom-dia

_Reescrito pela Máxima no fim de cada onda, ao pausar e no encerramento. Atualizado em 31/10/2026, 21:50 (fim da leva de 6 ondas)._

- **O que entrou nesta leva (24 PRs desde a retomada, além dos 16 anteriores):**
  - Cartório: versões do mundo (#32), cliente e renovação da trava no app (#41), última cópia do mundo na nuvem (#58).
  - Backup: pacote fechado (#38), backup agendado com o servidor rodando (#45), rotação que nunca apaga o último bom
    (#50); restaurar (bkp-2.2, #64) está na última correção.
  - Rede: script da máquina na nuvem (#42), tutorial para criar a máquina (#51), proxy Velocity (#48), rede privada
    WireGuard (#60), sala de espera (#62).
  - Launcher: achar o Prism (#36), instância do grupo no Prism (#57). Migração: quem deve hospedar (#54).
  - Base: testes estáveis sob carga (#43), verificador barra conflito de merge (#65).
- **Tutoriais para testar:** `docs/tutoriais/rede-criar-maquina.md` — criar a máquina Oracle (quando você quiser).
- **Decidi por você:** formato .tar.gz com a lib `tar`; Prism mínimo 8.0; tipos do cartório copiados no app; teste de
  ponta a ponta em `tests/integracao/`; nuvem guarda 3 cópias do mundo; rede privada 10.66.0.0/24 com SSH aberto só com
  chave; limbo PicoLimbo (MIT); exceção à regra de 2 devoluções no cart-2.1 (regra de ouro 1).
- **Esperando você:**
  1. Ligar a proteção da `main` (PR #7) e criar os rótulos (`docs/ops/rotulos.md`).
  2. Escolher a versão do Minecraft/NeoForge (antes do teste no seu PC, host-3.1).
  3. Quando quiser: criar a máquina Oracle pelo tutorial — e, ANTES de rodar o script, conferir a impressão digital
     da chave NodeSource (passo 5) e me pedir para fixar o hash do PicoLimbo (redemel-2.3, precisa de internet).
  4. D9 (assinatura do instalador) mais adiante.
- **Custo:** Ondas 1–3: US$ 5,84; Ondas 4–11: US$ 29,51 (24 filhas). A orquestração neste chat (Opus) custou ~US$ 55.
- **O que não foi verificado:** nada rodou num PC Windows nem num Minecraft de verdade; downloads reais (Adoptium,
  Modrinth, NeoForge, Velocity, PicoLimbo, NodeSource) não testados (sem internet aqui); scripts da nuvem só em
  simulação (sem Docker); o proxy fica desligado até a whitelist (redemel-2.1).
