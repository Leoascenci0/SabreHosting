# Plano appmel-1.5 — Retomar a própria trava depois de reabrir o app

Issue #98 · Triagem M4 (M1 de `cliente.eu()`) · risco alto (trava de host, regra de ouro 1).

## Problema
App reaberto sem servidor e este PC ainda dono da trava: a tela mostra "Servidor no PC de <este PC>" até a trava
vencer (~60 s). O cartório já aceita `pegar` quando o dono é o próprio PC, então basta a tela oferecer "Hospedar".

## Desenho
1. `DepsInicio` ganha `eu()` (quem é este PC: `GET /eu`, já existe no cliente) e `servidorOrfao()` (há servidor
   vivo na pasta deste PC? `true` também quando não dá para saber).
2. `estado()`: dono da trava = `eu().id`, sem `ativo`/`ocupado` nesta sessão e `servidorOrfao() === false` →
   `{tipo:"ninguem"}`. Falha em `eu()` ou em `servidorOrfao()` → comportamento atual ("outro"). O id de `eu()` fica
   guardado depois da primeira resposta (não muda).
3. `depsReais.servidorOrfao()` (lado seguro: na dúvida, `true`):
   - sem pasta configurada → `false` (não há onde ter servidor; Hospedar já recusa sem configuração);
   - Linux: algum processo (fora o próprio app) com diretório atual = a pasta (`/proc/<pid>/cwd`) → `true`;
   - Windows: o Java prende `<pasta>/<level-name>/session.lock` (trava obrigatória do Windows): ler o arquivo falha
     → `true`; arquivo ausente ou legível → `false`;
   - outro sistema → `true` (incerto).
4. Nada no cartório, no núcleo, no renovador; sem tela nem texto novos.

## Testes (falham antes, passam depois)
- `inicio.test.ts`: "dono sou eu sem servidor vira ninguém"; "dono sou eu com órfão vivo não oferece Hospedar";
  falha no `eu()` mantém "outro"; durante o `hospedar` em curso não vira "ninguem".
- `deps-reais.test.ts`: `eu` chama `GET /eu`; `servidorOrfao` no Linux acha processo com cwd na pasta; Windows com
  `session.lock` legível/ilegível; sistema desconhecido → `true`.
- E2E: cenário "dono sou eu, sem servidor" (tela "ninguem", Hospedar sobe) e "dono sou eu, com órfão" (fica "outro").
