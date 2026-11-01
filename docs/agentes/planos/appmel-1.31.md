# Plano appmel-1.31 — Modo demonstração: "Explorar sem grupo"

Base 43088f5 · ramo `roadmap/appmel-1.31` · método M5 + M1 (+ M7 pequeno) · risco alto.

## Desenho (o porquê)
- O app inteiro já sabe rodar com peças falsas (`fake-e2e.ts`, item 1.2). A demonstração reaproveita **só as peças**,
  sem a variável `SABRE_E2E`. O modo vive **em memória do processo** (default desligado): fechou o app, acabou.
- Novo `main/demonstracao.ts` (puro, testável): `criarDemonstracao(montar)` guarda a flag e monta as peças falsas
  uma vez; `protegerEscrita(demo, fazer)` devolve "Isso é só uma demonstração." no lugar de executar.
- `principal.ts`: cada leitura passa a ler da peça de demonstração quando a flag está ligada; cada **escrita**
  (hospedar, parar, jogar, restaurar, importar, salvar configurações, grupo/mods/versões, trocar pasta, abrir com
  Windows) passa por `protegerEscrita` **no main**. Servidor de arquivos, espalhar, mods e agenda de backup não são
  tocados (sem grupo já são inertes: sem token/URL/pastas, confirmado no código).
- Canais novos: `sabre:bv:explorar` e `sabre:bv:sair-demo`. `sabre:bv:estado` devolve `{aberto:false, demonstracao:true}`
  em demonstração; a tela recarrega e mostra o início + faixa fixa "Modo demonstração" com "Sair da demonstração".
- As peças falsas ganham um parâmetro `dono` (em vez de variável nova) para a demonstração mostrar Configurações completa.

## Passos (TDD)
1. e2e (Electron, **sem** `SABRE_E2E`) que falha: botão, recusas no main, nada gravado, sair volta ao convite.
2. Teste de unidade de `demonstracao.ts`.
3. Código: demonstracao.ts, fake-e2e (param `dono`), boas-vindas-app/principal/preload/ponte, index.html, boas-vindas.ts, tela.css.
4. `npm run vistoria` e `vistoria:comum`; PR.

## Não confirmado
Windows real com o instalador novo (P: Eliel).
