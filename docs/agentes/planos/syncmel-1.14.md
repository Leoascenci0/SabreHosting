# Plano syncmel-1.14 — Alcançar: aviso de erro na tela e progresso do download

Método: M1+M3 (reaproveitar o callback de progresso de `alcancar.ts`; ligar na tela). Sem lib nova.

## O que muda
1. **Progresso do download** — `ClienteCartorio.baixarPacote` ganha o 5º parâmetro `aoBytes(feitos, total)` (total =
   `content-length`, já conferido). `alcancar` o liga: o download ocupa 0–50% e a aplicação dos arquivos 50–100%
   (a barra não volta atrás). No caminho de PCs, a barra segue 0–100% como hoje.
2. **Falha local não tenta a nuvem** — nova `ErroLocal` (em `aplicar.ts`) para "servidor rodando", "este PC hospeda",
   "perdeu a trava de atualização", "servidor órfão/no ar", "já atualizando", "sem pastas". `alcancar` repassa esse erro
   sem cair na nuvem (a nuvem não resolveria e só gastaria banda).
3. **Aviso na tela** — `principal.ts` guarda o último aviso da atualização (limpo quando uma rodada nova começa);
   `criarInicio` ganha `avisoAtualizacao?()` e põe `aviso` nos estados `ninguem`/`outro`/`eu`; `tela.ts` mostra no
   `detalhe`. Texto em pt-BR: "Não consegui atualizar o mundo: <motivo>. Tento de novo em alguns minutos."

## Testes (TDD, falham antes)
- `cliente.test.ts`: `aoBytes` avança e termina em total.
- `alcancar.test.ts`: progresso cresce durante o download da nuvem; erro local (trava perdida / servidor rodando) não
  chama `baixarPacote`; erro de rede dos PCs ainda cai na nuvem.
- `inicio.test.ts`: `aviso` aparece no estado quando `avisoAtualizacao` devolve texto.
- `espalhar-versao.test.ts`: recusas locais são `ErroLocal`.

## Fora do escopo
Retentativa automática, lib de retry, mudar o relógio de 10 min.
