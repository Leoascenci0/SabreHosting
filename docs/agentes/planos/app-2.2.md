# Plano app-2.2 — Tela de configurações (corte decidido pela Máxima)

**Entra:** Geral › Abrir com o Windows; Servidor › Distância de visão e de simulação.
**Fica fora (viram itens):** Backups (intervalo e quantos guardar: o agendador e a rotação não estão ligados no app),
Grupo › Tirar PC do grupo (espera o cartmel-2.3: rota `GET /pcs` e `dono` no `/eu`), e os demais campos do briefing.

## Triagem
M2+M1: estender `preferencias.ts` (sem arquivo paralelo); exportar `validarDistancias` do núcleo (única validação de
faixa, a mesma do `gerarPropriedades`); tela em `apps/desktop/src/ui/configuracoes.*`, molde da tela de backups.

## Passos (TDD)
1. Núcleo: `validarDistancias(visao, simulacao)` + padrões 10/8 exportados; `gerarPropriedades` passa a usá-la. Teste.
2. `preferencias.ts`: campos `distanciaVisao`/`distanciaSimulacao`, leitura tolerante (campo torto = padrão, sem perder
   o outro), `opcoesDoServidor(pref)` para o núcleo. Testes.
3. Main: `configuracoes.ts` (puro, testável) com `ler()` e `salvar(valor)` que valida ANTES de gravar e devolve
   `Resultado` pt-BR; IPC `sabre:config:ler|salvar` com `veioDaPagina`; preload e `ponte.ts`.
4. UI: `configuracoes.ts` + HTML/CSS; áreas Geral e Servidor; a área Grupo não é criada vazia (entra com o botão
   depois). Estado "salvando", erro em pt-BR, confirmação de valor salvo; sem termo técnico.
5. E2E: valor inválido não salva (arquivo intacto); válido grava e chega ao núcleo (`gerarPropriedades`).
6. `impeccable` audit/polish, `npm run vistoria`, PR.

## Riscos
- Nada ainda lê as distâncias para subir o servidor (o IP da rede privada e a pasta vêm da tela de primeira vez);
  o PR diz isso em "O que NÃO foi confirmado".
