# Plano appmel-1.9 — Ligar as distâncias de visão/simulação ao subir o servidor

Método: M1 (reaproveitar) + ligação nova no `hospedar` de `apps/desktop/src/main/deps-reais.ts`.

1. Testes primeiro (`deps-reais.test.ts`): visão 12 / simulação 6 salvas em `preferencias.json` aparecem no
   `server.properties` depois de hospedar (spawn falso); sem túnel → erro em pt-BR e nenhum processo criado;
   com túnel, o `server-ip` é o do túnel. Os testes antigos de Hospedar passam a injetar um IP de túnel falso.
2. `ExtrasDepsReais` ganha `pastaDados` (onde mora `preferencias.json`) e `ipPrivado` (padrão `ipDaRedePrivada`).
3. No `hospedar`, antes de subir: sem IP privado → recusa e não grava nada; com IP →
   `gravarConfiguracao(pasta, { ipRedePrivada, ...opcoesDoServidor(lerPreferencias(pastaDados)) })`
   (sem `pastaDados`: padrões). Sem novo aceite, o `eula.txt` existente fica como está.
4. `principal.ts` passa `app.getPath("userData")`.
5. Não mexe na trava nem em `gravarConfiguracao`. Vistoria, PR.
