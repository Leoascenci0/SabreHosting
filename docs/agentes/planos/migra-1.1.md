# Plano migra-1.1 — Quem deve hospedar

Issue #52 · ramo `roadmap/migra-1.1` · método M7 (regra pura) · risco médio (decide, não executa; regras de ouro 1 e 5).

## Desenho
`packages/nucleo/src/migracao/decidir.ts` — `decidirHost({ host, candidatos, versaoMaisNova, agora, folga = 1.3, calmaMin = 10, ficarAte?, ultimaTrocaEm? })`,
PURA (sem relógio, sem rede, sem cartório). Tempos em ms desde a época (como o cartório). Devolve
`{ acao: "manter" | "trocar" | "eleger", para?: number, motivo }`.

- Candidato: `{ id, online, permitirHospedar, versao, nota | null }`. Válido = online + permitirHospedar + `versao === versaoMaisNova`
  (regra de ouro 5) + nota medida (finita, ≥ 0).
- **Sem host** (`host` nulo ou offline): `eleger` o válido de maior nota (empate: menor id); nenhum válido → `manter` sem `para`
  (motivo `sem-candidato`).
- **Com host**: ordem das checagens → `/ficar` vigente (`ficarAte > agora`) → `manter` ("ficar"); janela de calma (última troca há
  menos de `calmaMin` min) → `manter` ("calma"); sem válido (fora o próprio host) → `manter`; `trocar` só se melhor nota ≥ folga ×
  nota do host (e maior que ela, para host de nota 0 não trocar por empate de zeros); senão `manter` ("nota-insuficiente").
- Host com versão atrasada ou sem permissão **não força** troca aqui: só entra no motivo (`manter-host-versao-atrasada`, etc.);
  a troca forçada é do failover.
- `folga < 1`, `folga`/`calmaMin` não finitos ou `calmaMin < 0` → `RangeError` (folga < 1 trocaria de host por nota menor).
- Comparação com tolerância de 1e-9 para 1,3 × nota não falhar por ponto flutuante.

## Testes (primeiro, vermelhos) — `decidir.test.ts`
Tabela: empate exato em 1,3× (troca) e 1,29× (não); `/ficar` vigente e vencido (`ficarAte === agora` vencido); janela de calma
(dentro/limite); candidato com versão atrasada, offline ou sem permissão ignorado; nenhum válido; eleição sem host determinística
(empate → menor id, independente da ordem); host que caiu; host atrasado/sem permissão não força troca; folga inválida recusada;
entrada não é mutada.

## Fora
Execução da troca (migra-2.x), chamadas ao cartório, relógio real, tela "Folga para trocar de host" (app-2.2).
