# Arquitetura do SabreHosting

Desenho aprovado na conversa com o Eliel em 30/10/2026. Decisões ainda abertas estão marcadas **(Dx)** e listadas em
`docs/MILESTONE.md` › Pendente do Eliel.

## 1. A ideia em uma frase

Um host por vez, sempre o PC mais forte disponível; troca automática sem derrubar ninguém; o mundo guardado em todos
os PCs e numa máquina pequena na nuvem.

## 2. As peças

```
             internet
                │  (só 2 portas abertas: Minecraft e WireGuard)
   ┌────────────▼─────────────────────────────┐
   │ Máquina na nuvem (D3)                    │
   │  • Proxy Velocity  ← jogadores entram aqui│
   │  • Sala de espera (limbo)                │
   │  • Cartório (Node + SQLite)              │
   │  • Última cópia do mundo                 │
   │  • Hub da rede privada (WireGuard, D2)   │
   └───────▲──────────────▲───────────────▲───┘
           │ rede privada │               │
   ┌───────┴──────┐ ┌─────┴────────┐ ┌────┴─────────┐
   │ PC do host   │ │ PC amigo B   │ │ PC amigo C   │
   │ app + servidor│ │ app (bandeja)│ │ app desligado│
   │ Minecraft    │ │ cópia do mundo│ │ atualiza ao  │
   └──────────────┘ └──────────────┘ │ ligar        │
                                     └──────────────┘
```

| Peça | Onde | Tecnologia (proposta) | Faz |
|---|---|---|---|
| App desktop | PC de cada amigo | Electron + TypeScript (D8) | bandeja, Jogar/Hospedar, backups, configurações |
| Núcleo | dentro do app | TypeScript puro (`packages/nucleo`) | servidor Minecraft, backup, sync, trava, nota do PC, migração |
| Cartório | nuvem | Node + Fastify + SQLite (`services/cartorio`) | versão do mundo, trava com época, quem tem cópia, convites |
| Proxy | nuvem | Velocity + plugin próprio pequeno | porta única para os jogadores; move todos na troca de host |
| Sala de espera | nuvem | NanoLimbo (ou similar leve) | segura os jogadores durante a troca |
| Rede privada | todos | WireGuard com hub na nuvem (D2) | liga PCs e nuvem sem abrir porta em casa |
| Servidor de jogo | PC do host | NeoForge + Sinytra Connector (D5: mods Forge e Fabric juntos), Java via Adoptium | o Minecraft em si |
| Histórico longo (opcional) | PC do Eliel | Google Drive para Computador | backup diário/semanal numa pasta sincronizada |

## 3. Fluxos principais

### 3.1 Primeira partida do dia
1. Amigo abre o app → app pergunta ao cartório: versão mais nova? alguém hospeda?
2. Ninguém hospeda e a cópia local está em dia → app pega a trava (época +1), sobe o servidor, avisa o proxy.
3. Os outros entram pelo endereço fixo do proxy.

### 3.2 Backup periódico (a cada X min, Configurações)
`save-off` → `save-all flush` → pacote com manifesto e hashes → `save-on` → envia ao cartório (com época) → cartório
dá a versão N+1 → app espalha o delta para os PCs online e para a nuvem.

### 3.3 PC mais forte entrou (migração)
1. Nota do PC novo ≥ 1,3 × nota do host e ninguém pediu `/ficar` → começa.
2. Pré-cópia em segundo plano (delta até a versão atual).
3. Aviso no chat: "mudando de casa em 30 s".
4. Proxy manda todos para a sala de espera → host antigo salva e para → delta final → trava passa ao novo (época +1)
   → novo sobe → proxy devolve todos ao mundo. Meta: < 20 s.
5. Falhou antes do novo subir → antigo retoma.

### 3.4 Host caiu
Trava expira (~60 s) → proxy segura jogadores na sala de espera → o mais forte online com a versão mais nova (ou que
baixa da nuvem) pega a trava e sobe. Perda máxima: o que houve depois do último backup (por isso backup frequente).

### 3.5 Amigo voltou depois de um mês
App inicia com o Windows → pergunta a versão → baixa só as regiões que mudaram (de um PC online ou da nuvem) → troca
atômica → pronto para hospedar.

## 4. Onde o mundo fica

| Onde | O que | Para quê |
|---|---|---|
| PC de cada amigo | `mundo/` atual + últimos N backups | hospedar e jogar |
| Nuvem | última versão + alguns backups + cartório | garantir que o mundo sempre exista |
| Drive do Eliel (opcional) | histórico longo | voltar meses atrás |

## 5. Pastas do repositório (a partir do item base-1.1)

```
apps/desktop/        app Electron (tela)
packages/nucleo/     lógica sem tela, testável na nuvem
services/cartorio/   serviço da nuvem
infra/vps/           Velocity, limbo, WireGuard, scripts de instalação
scripts/             verificador, estado dos roadmaps, limites
tests/mundos/        mundos de teste gerados (nunca o mundo real)
docs/                arquitetura, roadmaps, milestone, memória, ops
```

## 6. Limites conhecidos (ditos ao Eliel)

- Mods (D5): nem todo mod Fabric roda pelo Sinytra Connector, e a versão do Minecraft fica presa às que o Connector
  suporta. A lista de mods é a mesma no servidor e em todos os jogadores (lanc-1.4); o proxy Velocity precisa de um
  mod de compatibilidade de encaminhamento no servidor NeoForge (a confirmar no rede-2.1).

- Não dá para dividir o processamento do mundo entre vários PCs (o servidor precisa ser a única fonte da verdade).
- Troca de host tem uma pausa curta (tela de carregamento); zero pausa é impossível.
- Se o host cai de repente, perde-se o que houve desde o último backup.
- A máquina na nuvem é o único ponto fixo: sem ela, os amigos não conseguem entrar (o mundo continua salvo nos PCs).
