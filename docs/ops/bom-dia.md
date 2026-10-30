# Bom-dia

_Reescrito pela Máxima no fim de cada onda, ao pausar e no encerramento. Atualizado em 30/10/2026, 18:16 (pausa)._

- **O que entrou (16 PRs na `main`, vistoria 206 testes APROVADA):**
  - Decisões D8, D1, D5 (PR #2).
  - Base: monorepo (#3), CI no GitHub (#7), mundos de teste (#9), modelos de issue (#8).
  - Servidor: baixar Java/servidor com hash (#12), EULA e configuração (#20), subir/parar com trava obrigatória
    (#24), salvar com segurança pelo console (#30), nota do PC (#16).
  - Backup: manifesto do mundo (#21) e caminhos válidos no Windows (#29).
  - Cartório: serviço com token (#15), trava de host com época (#22), época blindada (#27).
- **Em curso:** cart-1.3 (versões do mundo), numa sessão filha.
- **Próximo:** bkp-1.2 (pacote fechado), lanc-1.1 (achar o Prism), depois a Onda 7.
- **Tutoriais para testar:** nenhum ainda (o primeiro vem no fim do M1, com o host-3.1 no seu PC).
- **Decidi por você** (tudo em `docs/ops/DECISOES.md`, reversível): Electron só no app-1.1; Node 22; mundos de
  teste gerados na hora; Fastify + SQLite nativo; NeoForge + Sinytra Connector (D5); nota do PC com 100 = referência
  e sem teto; "permitir hospedar" desligado por padrão; proxy confere a conta Microsoft e o servidor fica só na rede
  privada com whitelist; RAM automática = metade da RAM, máx. 12 GB; comandos pelo console, sem RCON; mergeei o
  host-1.2 com 1 teste faltando (virou hostmel-1.4) em vez de tirar o item da rodada.
- **Esperando você:**
  1. Ligar a proteção da `main`: passo a passo no PR #7 (Settings › Branches).
  2. Criar os 8 rótulos das issues: `docs/ops/rotulos.md`.
  3. Abrir um chat novo com `/maxima retomar` para continuar a rodada (esta orquestradora pausou com ~48% de contexto).
  4. Mais adiante: D2/D3 (rede, máquina na nuvem), D4 (ícone), D6 (regras do grupo), D9 (assinatura), versão do
     Minecraft.
- **Custo:** filhas das Ondas 1–3: US$ 5,84; Ondas 4–6: não registrado ainda (a retomada registra). A orquestradora
  (este chat, Opus) custou ~US$ 21 até a pausa.
- **O que não foi verificado:** nada rodou num PC Windows; downloads reais (Adoptium, Modrinth, NeoForge) não testados
  (sem internet na nuvem); nenhum Minecraft de verdade foi iniciado; a nota do PC foi calibrada só na nuvem; as faixas
  de distância de visão não foram conferidas na documentação oficial (site bloqueado).
