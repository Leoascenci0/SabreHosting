# Plano app-1.3b — Assistente de primeira vez (Convite → EULA → Pasta)

Base: 1bed24a. Spec: `docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md` §5.2, §5.3, §6.
Triagem: M5 (tela pelo molde de Importar/Grupo) + M1 (reaproveita `lerConvite`, `criarCofreSeguro`, `gerarChavesDoPc`,
`montarConfigDoPc`, `aplicarNoWindows`, `cliente.usarConvite`, `perguntaEula`/`gerarEula`). Risco alto (segredo, rede).

## Peças
1. `main/boas-vindas.ts` (novo, lógica sem Electron, deps injetadas): `estado`, `conferirConvite`, `entrar`, `eula`,
   `aceitarEula`, `concluir`. O texto do convite e as chaves ficam só no main (a janela nunca recebe segredo).
   Ordem do `entrar`: convite ainda válido → **cofre disponível (antes de gastar o convite)** → chave própria → passo
   elevado → token no cofre → `GET /grupo`. Convite torto/vencido/usado: mensagem fixa, nada muda, token não usado.
   Estado persistido em `boas-vindas.json` (troca atômica): `grupo` (já entrou) e `concluido` + `pastaBase`.
2. `main/entrada-no-grupo.ts` (novo): o passo elevado de verdade (instala túnel provisório → `usarConvite` → regrava
   com a chave própria), com `aplicarNoWindows`/executor/cliente injetáveis; testado com falsos.
3. `ui/boas-vindas.ts` + trecho em `index.html`/`tela.css`: 3 passos, "conexão privada com o grupo" (sem "túnel").
4. Ponte: `ponte.ts`, `preload.cts`, `principal.ts` (só o mínimo: criar, registrar IPC), `fake-e2e.ts` (deps falsas).

## Testes (primeiro, falham antes)
Unidade (`boas-vindas.test.ts`, `entrada-no-grupo.test.ts`): convite vencido/torto/usado → mensagem e nada muda; sem cofre
→ não gasta o convite e não guarda; sem aceite do EULA não conclui; pasta relativa/raiz recusada; texto do convite nunca
em mensagem nem log; assistente só abre se ainda não configurou. E2E (`boas-vindas.e2e.ts`) com cartório falso.

## Fora (app-1.3c e melhorias)
Criar convite, validade, tirar `SABRE_ENDERECO`/`SABRE_CARTORIO_TOKEN`, registrar `sabre://`, campo em Configurações
(registrado como melhoria no PR). Prova real do UAC/túnel no Windows: [P].
