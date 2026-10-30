# Plano bkp-2.1 — Rotação segura de backups

Issue #47 · ramo `roadmap/bkp-2.1` · método M7 (plano puro + aplicação) · risco ALTO (apaga arquivos; regra de ouro 4).

## Desenho
`packages/nucleo/src/backup/rotacao.ts`:
- `planejarRotacao(backups, { recentes = 10, diarios = 7, agora })` — PURA. Cada backup: `{ nome, data, estado: "bom" | "ruim" | "nao-conferido", sha256? }`.
  - mantém: os `recentes` mais recentes + o mais recente de cada um dos últimos `diarios` dias (dia civil no fuso local,
    hoje incluído) + SEMPRE o backup `bom` mais recente + todo `nao-conferido`.
  - sem nenhum `bom`: não apaga nada (não há o que proteger nem prova de qual é bom).
  - `recentes` precisa ser inteiro ≥ 1 (0 apagaria tudo); `diarios` inteiro ≥ 0.
- `aplicarRotacao(pasta, plano, { simular, conferir })`:
  1. recusa plano incoerente (apagar com item de `manter`, com `nao-conferido`, ou `manter` sem nenhum `bom`);
  2. ANTES de apagar, reconfere na hora (hash + manifesto, via `abrirPacote`) os `bom` de `manter`, do mais novo ao mais
     velho; se nenhum passa, lança erro e não apaga nada;
  3. só apaga arquivo comum (`lstat`, nunca link) cujo nome bate com o padrão do SabreHosting
     (`<data>-v<versao>.tar.gz`) dentro da pasta; o resto vai para `ignorados`; apaga um por um, falha vai para `falhas`;
  4. `simular: true` devolve o resultado sem apagar nem reconferir (só classifica).
- `conferirPacote(pasta, backup)`: conferidor padrão (`abrirPacote` em pasta temporária, apagada depois); injetável nos testes.

## Testes (primeiro, vermelhos)
Propriedade com semente (PRNG próprio, milhares de sequências, sem lib): sempre sobra ≥ 1 bom; nunca apaga o `bom` mais
recente; nunca apaga `nao-conferido`; as janelas (10 + 7 dias, fuso local) mantêm o que devem; sem bom não apaga.
Exemplos: janelas fixas; `recentes`/`diarios` inválidos; dry-run não toca disco; aplicar real apaga só o plano;
único bom corrompido entre o plano e a aplicação (pacote real, 1 MB) → nada apagado; arquivo estranho/link/pasta nunca
apagado; plano adulterado recusado.

## Fora do escopo
Restauração (bkp-2.2); montar a lista (catálogo/cartório) e a tela "Quantos guardar" (app-2.2); nenhuma dependência nova.
