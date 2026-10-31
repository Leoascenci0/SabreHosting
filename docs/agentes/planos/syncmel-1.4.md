# Plano syncmel-1.4 — recuperar o mundo se o app cair entre os dois rename da troca

Método: M7 (+M1). Risco alto (mexe no mundo). Regras de ouro 2–4.

## Problema
Troca = `rename(mundo → .antigo)` e `rename(temp → mundo)`. Morreu entre os dois: só sobram `.antigo` e a temporária, e o servidor sobe com mundo ausente e cria um mundo novo.

## Desenho (sem arquivo novo, sem marcador de "subida" separado)
1. `configurar.ts`: `MARCADOR_TROCA = "TROCA-EM-ANDAMENTO.json"`; `podeSubir` recusa enquanto existir (mesmo portão do marcador de restauração).
2. `restaurar.ts`: `gravarMarcadorTroca` (grava `{mundo, antigo, temp}` de forma atômica ao lado do mundo, depois da conferência do hash e antes do rename 1), `apagarMarcadorTroca` (depois do rename 2 ou do desfazer bem-sucedido) e `recuperarTroca(pastaDoServidor)`:
   - sem marcador: nada;
   - marcador + mundo presente: só apaga marcador e temporária (nunca o `.antigo`);
   - marcador + mundo ausente + `.antigo` presente: `desfazer` (volta N), apaga temporária e marcador;
   - marcador + mundo ausente + `.antigo` ausente: deixa o marcador (servidor continua travado) e erra em pt-BR.
   - marcador ilegível ou com caminhos fora da pasta: erra e mantém a trava.
   - O `.antigo` nunca é apagado na recuperação (regra 4). Desfazer é o padrão seguro; não completo a troca.
3. `aplicar.ts` e `restaurar.ts` usam os helpers; gancho de teste `aposPrimeiroRename` em `OpcoesAplicar`/`OpcoesRestaurar` para simular o kill.
4. Chamadas: `iniciarServidor` (antes de `podeSubir`, em `subirServidor`) e início do app (`principal.ts`, antes de `criarInicio`) lendo a pasta do servidor.

## Testes (mundos inventados)
- estado pós-kill montado em disco → `podeSubir` recusa; `recuperarTroca` devolve N com os mesmos hashes e libera;
- mundo presente + marcador → só limpa, `.antigo` fica;
- kill injetado entre os renames em `aplicarDelta` e `restaurarBackup`.

## Dúvidas da triagem
- `aplicarDelta` ainda não tem chamador de produção: gancho pronto, dito no PR.
- Marcador fica em `dirname(mundo)`; `podeSubir` o lê na pasta do servidor. Vale se o mundo é filho direto da pasta do servidor (como o Minecraft cria). Dito no PR.
