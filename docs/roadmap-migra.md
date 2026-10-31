# Roadmap — Migra (o servidor muda para o PC mais forte, sem derrubar ninguém)

Objetivo: quando entra um PC bem mais forte, o servidor muda para ele com uma tela de carregamento de menos de 20 s; se
o host cai, o mais forte online assume.

**Sigla `migra`.** Ramos `roadmap/migra-<id>`. Código em `packages/nucleo/src/migracao/`. Leitura obrigatória:
`qualidade-sabre › integridade` §1 e §5. Todo item é RISCO alto, revisão com duas lentes e modelo Opus (gatilho:
lógica de trava/migração).

## Bloco 1 — Decidir

- [x] **1.1 — Quem deve hospedar** (PR #54, 30/10/2026)
  *O que fazer:* regra pura: candidatos online com versão em dia e permissão de hospedar; troca só se nota ≥ folga ×
  nota do host (padrão 1,3); respeitar `/ficar` (adiar 30 min) e janela de calma.
  *Arquivo:* `packages/nucleo/src/migracao/decidir.ts`
  **Tela no app:** Configurações › Grupo › "Folga para trocar de host". D6 decidida (folga 30%).
  *Confirmação:* testes de tabela cobrindo empate, `/ficar`, versão atrasada.
  *Depende de:* host-2.3, cart-1.3

## Bloco 2 — Trocar

- [x] **2.1 — Pré-cópia em segundo plano** (PR #197, 31/10/2026; `pedirPreCopia` reaproveita o espalhar e devolve manifesto+vazão; `medirDeltaFinal` pura: delta ~1,2% < 5% no mundo de 20 MB; falta teste de recusa do ramo "ja-tinha" com `hospedaAgora`; o `epoca: 0` do manifesto local não vale como época real na migra-2.2)
  *O que fazer:* o novo host puxa a versão atual enquanto o antigo joga; mede o tempo previsto do delta final.
  *Arquivo:* `packages/nucleo/src/migracao/precopia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: após a pré-cópia, delta final < 5% do mundo de teste.
  *Depende de:* migra-1.1, sync-1.2

- [ ] **2.2 — A troca (sequência fixa)**
  *O que fazer:* aviso no chat (30 s) → proxy manda todos ao limbo → antigo salva e para → delta final → trava passa ao
  novo (época +1) → novo sobe → proxy devolve todos. Falha antes do novo subir: antigo retoma. Medir e registrar o tempo.
  *Arquivo:* `packages/nucleo/src/migracao/trocar.ts`
  **Tela no app:** status "Mudando o servidor para o PC do X".
  *Confirmação:* teste de integração com 2 PCs simulados, proxy e cartório em contêiner: < 20 s com 1 GB e 50 Mbps
  simulados; injeção de falha em cada passo → nunca dois hosts.
  *Depende de:* migra-2.1, rede-2.2, rede-2.3. SOZINHO na onda.

- [ ] **2.3 — Host caiu (failover)**
  *O que fazer:* trava expirou → proxy segura no limbo → o mais forte online com versão mais nova assume (ou baixa da
  nuvem antes).
  *Arquivo:* `packages/nucleo/src/migracao/failover.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: matar o host simulado → outro sobe; jogadores voltam.
  *Depende de:* migra-2.2

## Bloco 3 — Prova com amigos

- [ ] **3.1 — Teste real de troca**
  *O que fazer:* roteiro para 3 amigos: jogar, entrar o PC forte, conferir a troca, derrubar o host de propósito.
  *Arquivo:* `docs/tutoriais/migra-teste-real.md`
  **Tela no app:** não se aplica.
  *Confirmação:* relatório do teste com os tempos medidos. **[P: teste com amigos]**
  *Depende de:* migra-2.3, app-1.2
