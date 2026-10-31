# Plano lancmel-2.1 — Tela "Mods do grupo" e `sincronizarMods` no app

Método: M5+M1 (reaproveitar `sincronizarMods`, `lerModsGrupo`/`gravarModsGrupo`, molde da área Grupo/Versão). ~250 linhas. Risco alto (mexe em pasta de mods e em lista que vale para todos). Sem endpoint novo.

1. `apps/desktop/src/main/mods-grupo.ts` (lógica pura com `deps` injetadas, testada com cartório falso):
   - `estado()`: qualquer PC vê a lista; `dono` diz se pode editar (o cartório diz, a janela não decide); `atualizando` e o resumo da última sincronização.
   - `adicionar(mod)` / `tirar(arquivo)`: só o dono; relê a lista do cartório na hora (a janela pode estar velha), aplica a mudança, valida com `validarModsGrupo` (host `cdn.modrinth.com`, nome `.jar`, hash) e grava; depois sincroniza.
   - `sincronizar()`: uma por vez; instância do Prism (se a pasta for conhecida) e pasta `mods` do servidor (só com o servidor parado, regra de ouro 2). Falha de um mod não derruba o resto; o motivo vai para a tela em pt-BR.
2. Arranque: `principal.ts` chama `sincronizar()` depois de montar o app (não bloqueia a janela). Pastas: servidor = `<SABRE_PASTA_SERVIDOR>/mods`; instância = `SABRE_PASTA_MODS_INSTANCIA` (só passa a existir de verdade com o lancmel-2.2; sem ela o lado do cliente é pulado e dito na tela).
3. Ponte: `sabre:mods:estado|adicionar|tirar` (preload + `ponte.ts`); o main valida tudo que vem da janela.
4. Tela: Configurações › Grupo › "Mods do grupo": lista para todos; só o dono vê "Adicionar mod" (nome, versão, arquivo, link, hash, lado) e "Tirar" (com confirmação); "Atualizando mods…" enquanto roda.
5. Fake do E2E (`fake-e2e.ts`) + teste de unidade: dono edita, amigo vê, não-dono não edita, servidor rodando não mexe na pasta do servidor.

Fora: Prism de verdade (2.2), redirect/não apagar antes de baixar (2.3).
