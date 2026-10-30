# Plano bkp-1.1 — Manifesto do mundo

Método: M1 (mover `hashDoArquivo`) + M7 (manifesto e comparação). Risco alto: base do delta. Só **lê** a pasta do mundo
(regra de ouro 2: quem chama garante `save-off`; o bkp-1.3 faz isso).

1. Teste primeiro (falha): `integridade/hash.test.ts`, `backup/manifesto.test.ts`.
2. `integridade/hash.ts`: `hashDoArquivo(caminho, algoritmo = "sha256")` em fluxo; `baixar.ts` importa de lá.
3. `backup/manifesto.ts`: `gerarManifesto`, `validarManifesto`, `compararManifestos`.
   Formato `{formato:1, versao, epoca, criadoEm, arquivos:[{caminho,tamanho,sha256}]}`.
   Percorre com `opendir` recursivo, um arquivo por vez; ordena; ignora link simbólico (aviso) e `session.lock`.
4. Prova de memória: teste lê o mundo de 20 MB e confere que o pico de `arrayBuffers` fica bem abaixo de 20 MB.
5. `npm run vistoria`, PR com `Closes #18`.
