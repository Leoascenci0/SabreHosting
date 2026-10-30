# cart-2.1 — Cliente do cartório no núcleo · plano

> Execução: nativa (sessão filha da Máxima, "pode seguir" dado). Briefing: `docs/agentes/briefings/cart-2.1.md`
> (ramo `claude/youthful-knuth-er1s6b`). Issue #37.

**Objetivo:** o núcleo fala com o cartório (tipado, com prazo e novas tentativas seguras), guarda o token num cofre
injetado e mantém a trava de host renovada; perdeu a trava → `save-all` + parada do servidor.

**Arquitetura:** quatro arquivos pequenos em `packages/nucleo/src/cartorio/` + um `hospedar.ts` que liga o renovador ao
`iniciarServidor({ temTrava })` já existente. Nada de `services/cartorio` é importado pelo núcleo; só o teste de ponta a
ponta (`tests/integracao/`) importa os dois lados.

## Restrições globais

- Regra de ouro 1: sem trava não hospeda; `temTrava()` só é `true` com renovação ok e prazo local valendo.
- Prazo contado pelo **relógio próprio** (monotônico, `performance.now`), marcado **antes** do envio; nunca pelo
  `expiraEm` do servidor. Prazo local = 3 × `renovarMs` (o cartório garante prazo ≥ 3 × renovação em `conferirTempos`)
  − margem (padrão `renovarMs / 2`).
- A época guardada é a que **este PC ganhou** no `pegar`; recusa nunca troca a época.
- Novas tentativas (espera crescente + jitter, relógio e sorteio injetados) só em erro de rede/5xx e só nos GETs e em
  `/trava/renovar`. `pegar`/`passar`/`soltar` nunca repetem (mudam a época).
- Token: vem do cofre a cada chamada, vai só no cabeçalho `Authorization`; nunca em mensagem de erro nem log.
- URL do cartório: `https` em qualquer endereço; `http` só para IP privado/loopback (rede WireGuard). Sem seguir
  redirecionamento (o token não pode ir para outro endereço).
- Nenhum timer pendurado: o renovador para em `soltar()`/perda; `hospedar` solta a trava quando o servidor para/cai.

## Arquivos

| Arquivo | Papel |
|---|---|
| `packages/nucleo/src/cartorio/tipos.ts` | Tipos das respostas (cópia escrita à mão das rotas de `services/cartorio/src/servidor.ts`) |
| `packages/nucleo/src/cartorio/cofre.ts` | `interface Cofre { guardar(token); ler() }` + `cofreEmMemoria()` |
| `packages/nucleo/src/cartorio/cliente.ts` | `ErroCartorio`, `criarCliente(opcoes)` → `eu`, `estadoTrava`, `pegar`, `renovar`, `passar`, `soltar` |
| `packages/nucleo/src/cartorio/renovador.ts` | `class Renovador` → `pegar()`, `temTrava()`, `soltar()` |
| `packages/nucleo/src/cartorio/hospedar.ts` | `hospedar(opcoes)` → `{ servidor, renovador }` |
| `*.test.ts` ao lado + `tests/integracao/trava-hospedar.test.ts` | provas |

`vitest.config.ts` já inclui `tests/**/*.test.ts` (cobre `tests/integracao/**`): sem mudança.

## Tarefas

### 1. Plano (este commit)

### 2. Cliente + tipos + cofre (TDD)
Testes (`cliente.test.ts`, `fetch` falso injetado):
- prazo: `fetch` que nunca responde → `ErroCartorio` tipo `rede` depois do prazo; GET repete `tentativas` vezes.
- `renovar` com 503 e depois 200 → 2 chamadas; esperas = `base·2^(n−1)·(0,5 + 0,5·sorteio)` exatas (determinístico).
- `pegar` com 500 → 1 chamada só (não repete); idem erro de rede em `pegar`.
- 401 não repete; 409 devolve a recusa tipada (`ok: false`, `motivo`).
- token só no cabeçalho; ausente no texto do erro; cofre vazio → erro "Este PC ainda não entrou no grupo".
- URL `http` para IP público recusada; `redirect: "error"`.

### 3. Renovador (TDD, relógio e `repetir` manuais)
- `pegar` guarda a época ganha e inicia a repetição a cada `renovarMs`; `renovar` vai com essa época.
- prazo marcado antes do envio: `pegar` que demora → prazo conta do início.
- recusa com época diferente → `aoPerder` uma vez, `temTrava` false, nunca renova com a época da recusa.
- `renovar` que nunca responde → passado o prazo local, `temTrava` false e o tique chama `aoPerder`.
- erro de rede isolado dentro do prazo → continua com a trava.
- `renovarMs` absurdo da resposta (0, decimal) → recusa hospedar.
- `soltar` cancela a repetição e chama `/trava/soltar` com a época.

### 4. Hospedar + ponta a ponta
`hospedar`: `renovador.pegar()` → `iniciarServidor({ ...opcoes, temTrava: () => renovador.temTrava() })`;
falhou ao subir → solta a trava; ao perder: `say` + `salvarSeguro(servidor, async () => {})` + `pararServidor()`;
servidor parado/caído → `renovador.soltar()` (melhor esforço).
Teste em `tests/integracao/` com `criarCartorio` real em 127.0.0.1 porta 0 (`trava: { prazoMs: 300, renovarMs: 100 }`)
e o servidor falso: (a) renovando, outro PC recebe `ocupada` depois de passado o prazo; (b) cartório fecha → prazo
local vence → log tem `save-all flush` antes do `stop` e o estado vira `parado`.

### 5. Vistoria + PR
`npm run vistoria` APROVADA; PR com `Closes #37`.

## Foco da revisão
1. Renovação lenta (>`renovarMs`) não pode sobrepor outra: tique pula se há uma em curso (teste na tarefa 3).
2. Relógio de parede que pula (hibernação/ajuste) não pode estender a trava: relógio monotônico por padrão.
3. Cartório devolvendo corpo não-JSON → `ErroCartorio` tipo `resposta`, sem travar.
4. `aoPerder` disparado duas vezes (tique + recusa) → uma parada só.
5. Servidor que cai sozinho não deixa a trava sendo renovada para sempre.
