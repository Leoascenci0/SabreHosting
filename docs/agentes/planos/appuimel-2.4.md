# Plano appuimel-2.4 — Início v2

Método: M5 (+M1). Só apresentação; nada muda em hospedar/backup/trava.

1. **Dados novos (TDD):** `DadosPainel.versaoMinecraft?` e `totalMemMb?` (ponte.ts); `inicio.ts` lê dois ganchos
   opcionais (`versaoMinecraft`, `totalMemMb`); `principal.ts` liga a `lerConfigGrupo().versaoMinecraft` e
   `totalmem()`. Teste de unidade: ausente = campo não existe.
2. **Regras puras (TDD)** em `ui/inicio-regras.ts`: `pecasDeEstado(e)` (Este PC / Servidor / Grupo, com tom + palavra)
   e `gradeDeNumeros(e, agora)` (jogadores, tempo ligado, RAM, mundo, backups, último backup, cada um com valor,
   comparação real ou "—" + dica). Sem número inventado; "Era X" nunca fabricado.
3. **Tela:** `index.html` (cartão principal com frase, versão, tempo ligado, jogadores; 3 peças; ações; grade;
   coluna "Quem está online" + "Endereço para os amigos" com Copiar), `tela.css`, `tela.ts` (desenha a partir das
   regras; mantém os ids usados pelos e2e). Atualização: evento `sabre:inicio:mudou` + intervalo curto só com o
   Início visível e a janela aberta.
4. **e2e:** 5 estados (ninguém, eu, outro, sem cartório, demonstração), sem afrouxar os existentes; 720x480 sem
   rolagem horizontal; capturas claro/escuro em `docs/imagens/appuimel-2.4/`.
5. **Fecho:** `docs/design-system.md` (nota curta), impeccable (audit, polish, detector), `npm run vistoria`, PR.
