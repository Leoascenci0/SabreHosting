# Bom-dia

_Reescrito pela Máxima no fim de cada onda, ao pausar e no encerramento. Atualizado em 30/10/2026, 17:30._

- **O que entrou:** decisões D8, D1, D5 (PR #2); Onda 1 — monorepo (PR #3); Onda 2 — CI (PR #7), mundos de teste
  (PR #9), modelos de issue (PR #8); Onda 3 — baixar Java/servidor com hash (PR #12), cartório com token (PR #15),
  nota do PC (PR #16). Vistoria da `main`: 59 testes, APROVADA.
- **Em curso:** Onda 4 — host-1.2 (EULA e configuração do servidor), bkp-1.1 (manifesto do mundo), cart-1.2 (trava
  de host).
- **Tutoriais para testar:** nenhum ainda (o primeiro vem no fim do M1).
- **Decidi por você:** Electron só no app-1.1; Node 22; mundos de teste gerados na hora; Fastify + SQLite nativo no
  cartório; NeoForge + Sinytra Connector (D5); nota do PC com 100 = PC de referência e sem teto (para a regra 1,3×
  funcionar); "permitir hospedar" desligado por padrão (até a D6).
- **Esperando você:**
  1. Ligar a proteção da `main`: passo a passo no PR #7 (Settings › Branches).
  2. Criar os 8 rótulos das issues: `docs/ops/rotulos.md`.
  3. Mais adiante: D2/D3 (rede, máquina na nuvem), D4 (ícone), D6 (regras do grupo), D9 (assinatura), versão do
     Minecraft.
- **Custo:** Ondas 1–3, 7 filhas: US$ 5,84 (a mais cara: cartório em Opus, US$ 2,66). Revisões `qa` não registradas.
- **O que não foi verificado:** nada rodou num PC Windows; os downloads reais (Adoptium, Modrinth, NeoForge) não
  foram testados (sem internet na nuvem); a nota do PC foi calibrada só com a máquina da nuvem; a disputa real entre
  dois processos no cartório não tem teste (cartmel-1.4).
