# Plano appmel-1.14b — respeitar `level-name` e validar `SABRE_JAVA`/`SABRE_NEOFORGE`

Método M4 (ajuste pequeno). Arquivos: `apps/desktop/src/main/config-pc.ts`, `deps-reais.ts`, `principal.ts` (1 linha) e os testes.

1. Teste primeiro (falha antes): `server.properties` com `level-name=Mundo` → `pastaMundo` = `servidor/Mundo`; nome torto (`..`, separador, absoluto, vazio) → `world`; env `SABRE_JAVA`/`SABRE_NEOFORGE` ignorado sem modo teste.
2. `nomeDoMundo(pastaServidor)` em `config-pc.ts`: lê `level-name`, só vale nome simples de pasta (S-07); senão `world`. `deps-reais.ts` passa a usar o mesmo helper (uma regra só).
3. `lerConfigPc(..., modoTeste = false)`: Java/NeoForge do ambiente só entram em modo teste; `principal.ts` passa `!app.isPackaged`.

Risco: o `level-name` é lido ao abrir o app; mudança com o app aberto vale na próxima abertura (registrado no PR).
