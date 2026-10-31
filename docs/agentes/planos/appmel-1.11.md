# Plano appmel-1.11 — ligar a rotação e expor "Quantos guardar"

Ramo `roadmap/appmel-1.11` · Base `37baba7`. Método: M1+M2 (+M7 só nas marcas bom/ruim). Risco ALTO (apaga backup).

## Decisões que valem (briefing)
- Guarda os N mais novos (padrão 10) e **tudo** dos últimos 7 dias; nunca o último bom nem os não conferidos.
- Fonte bom/ruim: o app (arquivo de marcas ao lado da pasta de backups). Sem marca = não-conferido (sempre fica).

## Passos
1. `rotacao.ts`: janela de dias passa a guardar TODOS os backups do período (`dias`, constantes `RECENTES_PADRAO`/`DIAS_PADRAO`
   exportadas num lugar só). Testes atualizados.
2. `rotacao-pasta.ts` (núcleo): marcas (`lerMarcas` valida tudo — entrada não confiável, S-07; `gravarMarca` com troca atômica),
   `rotacionarPasta` (lista a pasta, cruza com as marcas, `planejarRotacao` → `aplicarRotacao`; "ruim" só se a conferência de
   agora falhar; poda marcas de arquivos que não existem mais).
3. App: preferência `quantosGuardar` (inteiro ≥ 1, padrão 10), validação, tela Configurações › Backups › "Quantos guardar".
4. `rotacao-backups.ts` (main): uma rotação por vez (S-06), pula durante restauração; roda depois de cada backup bom
   (grava a marca "bom" primeiro) e no arranque. Erro vira aviso.
5. Provas: unitários das marcas (bom/ruim/sem marca/adulterada), integração com mundo inventado (N=3 → sobram 3 + janela;
   último bom e não conferidos nunca saem; nenhum bom passou → nada apagado), preferências/configurações/tela.

## Fora do alcance
Mínimo garantido, padrão 10, cartório, tela nova, campo de estado dentro do pacote.
