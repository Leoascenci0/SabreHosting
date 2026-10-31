# Plano appmel-1.1 — ícone próprio para a bandeja

1. Recortar a cabeça do tigre de `icone-512.png` (sem grama e sem texto) e gerar `bandeja-16/24/32/48.png`
   (script `gerar-bandeja.py`, só Pillow, fora do app). Cabeça sobre azulejo escuro de cantos arredondados:
   com fundo 100% transparente o pelo preto some em barra de tarefas clara.
2. `principal.ts`: `iconeDaBandeja()` monta um `nativeImage` com 4 escalas (1, 1.5, 2, 3); o Windows escolhe.
3. Teste: os 4 arquivos existem com o tamanho certo e `principal.ts` os carrega.
4. LEIAME do ícone explica como refazer. Janela e instalador não mudam.
5. Vistoria, PR (Closes #142), conferência no Windows 100%/150% fica com o Eliel.
