# Plano appmel-1.12 — Cofre: distinguir "não existe" de "corrompido"

Método: M4 (~30 linhas). Risco ALTO (segredo). Sem mundo, sem rede, sem token real (token de teste gerado na hora).

Problema: `ler()` do cofre devolve `undefined` tanto quando o arquivo não existe (primeira vez) quanto quando ele existe e não decifra (adulterado, outra conta do Windows). O assistente acha que é a primeira vez e nunca pede convite novo.

1. `main/cofre.ts`: novo `EstadoDoCofre` = `ok(token)` | `ausente` | `corrompido` | `indisponivel`, e `CofreSeguro` (= `Cofre` + `estado()`). `ler()` (contrato do núcleo, `string | undefined`) passa a derivar de `estado()`: nada muda para o núcleo. Só arquivo inexistente (`ENOENT`) é `ausente`; qualquer outra falha de leitura/decifragem é `corrompido`. Sem cofre do sistema: `indisponivel` (checado primeiro, como hoje). Arquivo nunca é apagado nem alterado ao ler; mensagens não repetem o token.
2. `main/config-pc.ts` (só o ponto do cofre): `LeitorDeToken` ganha `estado?()` opcional; `ConfigPc.cofreCorrompido?: true` quando o cofre diz `corrompido`. O token continua só `ler()`.
3. `main/boas-vindas.ts`: `deps.cofre` aceita `estado?()`; `estado()` do assistente, se o PC já estava configurado mas o cofre está `corrompido`, reabre no passo "convite" com `cofreCorrompido: true` (campo opcional em `EstadoBoasVindas`). A mensagem na tela é do app-1.3b (fora deste item).
4. Testes primeiro (Vitest): estado nos 4 casos, arquivo adulterado (bytes trocados no disco com o `safeStorage` falso que valida), `ler()` inalterado, config-pc e assistente.

Fora: texto da tela (app-1.3b), mexer em `config-pc.ts` além do cofre, apagar o arquivo corrompido (o novo convite o substitui por troca atômica).
