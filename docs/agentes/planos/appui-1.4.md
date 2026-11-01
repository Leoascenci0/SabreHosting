# Plano appui-1.4 — Grupo e Mods: telas próprias, listas limpas

Triagem: M5 (molde da tela de Backups) + M1 (ponte e regras prontas). Um PR, dois commits.

## O que já existe (grep)
- Ponte pronta: `ui/ponte.ts` (`grupo.estado/criarConvite/tirar`, `mods.estado/adicionar/tirar`). Nenhuma ponte/IPC nova.
- Lógica de Grupo e Mods hoje em `ui/configuracoes.ts` (abas "Grupo" e "Mods") e `index.html`.
- Molde de tela: `tela-backups` + `backups.ts`; barra: `navegacao.ts` + `navegacao-regras.ts`.

## Passos
1. **1.4a Grupo** (TDD): `e2e/grupo.e2e.ts` (migra os blocos de grupo/convite de `configuracoes.e2e.ts`; mantém "não-dono não vê" e "cancelar não revoga") e `e2e/navegacao.e2e.ts` (Grupo abre a tela própria). Depois `ui/grupo.ts` + `#tela-grupo` em `index.html` (lista de PCs, "Tirar do grupo" com confirmação, painel de convite com Copiar, link "Mods"), `tela.css`, `navegacao*.ts` (tira o caso "Grupo divide Configurações"). Tira aba/fieldset Grupo de Configurações. O endereço do servidor continua em Configurações › Servidor.
2. **1.4b Mods**: `e2e/mods.e2e.ts` (migra os blocos de mods) primeiro; depois `ui/mods.ts` + `#tela-mods` (subtela de Grupo, "← Grupo"; lista com nome, versão e onde vale; "Adicionar mod" em 3 passos curtos: nome e versão, arquivo, link; hash e "onde usar" em "Avançado" recolhido). Tira aba Mods de Configurações (sobram Geral/Servidor/Backups).
3. Docs: `docs/design-system.md` (Grupo e Mods próprios). Capturas depois em `docs/imagens/appui-1.4/` (`SABRE_CAPTURAS=1`).

## Regras
- Só interface. O texto do convite fica só na memória da tela (nunca guardado nem logado). Confirmação de "Tirar do grupo" e "Tirar mod" mantida; cancelar não revoga. Dono vem do estado da ponte, sem lógica nova no front.
- Validação de link/hash de mod continua no main (cdn.modrinth.com, sha512).
- Sem termo técnico na tela comum; "Avançado" recolhido.

## Fora do alcance / achados
- "Quando foi visto" do PC não existe em `PcDaTela` (precisa de dado do cartório/main): vira melhoria no PR, sem ponte nova aqui.
