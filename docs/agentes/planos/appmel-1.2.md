# Plano appmel-1.2 — teste da conferência de remetente da ponte

1. Teste primeiro (falha: `veioDaPagina` ainda não existe em `seguranca.ts`).
2. Mover `veioDaPagina(evento, pagina)` de `principal.ts` para `seguranca.ts` (exportada, tipo mínimo do evento, sem importar electron); `principal.ts` passa a importar e chamar com `PAGINA`.
3. Mutação manual (`veioDaPagina` sempre true) deve derrubar o teste.
4. `npm run vistoria` APROVADA; PR com `Closes #129`.

Sem mudança de comportamento da ponte, sem canal novo, nada em `ui/`.
