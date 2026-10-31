# Briefing appmel-1.9 — Ligar as distâncias de visão/simulação ao subir o servidor

BASE: 46a3dcb0ba6b1c20ed2917a4780c65dd45970996 · RAMO: roadmap/appmel-1.9 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination (só para ler a trava; não muda)
LEIA: qualidade-sabre §1, §integridade (trava/hospedar), §seguranca (rede: escuta só no IP privado)
TRIAGEM: M1 (+ ligação nova no `hospedar`) · ~35 linhas (+~60 de teste) · risco ALTO (único caminho que sobe o servidor, ao lado da trava; define o IP de escuta). REAPROVEITAR: `opcoesDoServidor(p)` (`apps/desktop/src/main/preferencias.ts:168`); `gravarConfiguracao(pasta, opcoes, aceite?)` (`packages/nucleo/src/servidor/configurar.ts:150`, já valida distâncias e IP); `ipDaRedePrivada()` (`apps/desktop/src/main/servir-arquivos.ts:16`); `lerPreferencias(pasta)` (`preferencias.ts:99`); `hospedar` em `deps-reais.ts:154-168`. NÃO ESCREVER: validação de distâncias nova, escrita atômica nova, lógica de trava nova, leitura de preferências nova. Achado: a premissa do item está incompleta — hoje NEM `opcoesDoServidor` NEM `gravarConfiguracao` têm chamador de produção, então o `hospedar` nunca grava `server.properties`. Passos: (1) em `deps-reais.ts`, antes de subir o servidor: `gravarConfiguracao(pasta, { ipRedePrivada: ipDaRedePrivada(), ...opcoesDoServidor(lerPreferencias(pastaDados)) })`; (2) a pasta de dados entra por parâmetro de `depsReais` (extras); `principal.ts` passa `app.getPath("userData")`; testes usam pasta temporária; (3) sem IP do túnel (e se `gravarConfiguracao` exige o IP), recusar Hospedar com mensagem clara em pt-BR e NÃO subir o servidor. Prova: `deps-reais.test.ts`: visão 12/simulação 6 salvas aparecem no `server.properties` depois de hospedar com spawn falso; sem túnel, erro e nenhum processo criado; mundo de teste em `tests/mundos/`.

## Item (texto literal do roadmap)
**1.9 — Ligar as distâncias de visão/simulação ao subir o servidor**
*O que fazer:* usar `opcoesDoServidor(lerPreferencias())` ao gravar a configuração no `hospedar` (hoje só os testes chamam).
*Arquivo:* `apps/desktop/src/main/deps-reais.ts`
**Tela no app:** não se aplica.
*Confirmação:* teste: valor salvo em Configurações aparece em `server.properties` ao hospedar.
*Depende de:* app-1.3 (feito)

## Decisões que valem para este item
Decidi pelo Eliel (reversível): recusar Hospedar quando o túnel privado não está ativo (o servidor só escuta no IP privado, regra de segurança). Se a filha achar que isso quebra algum fluxo existente (testes e2e, modo teste), registrar em "Achados fora do escopo" e manter o recuo mais conservador: não subir sem IP privado.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.9.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em apps/desktop/src/main/deps-reais.test.ts; PR com `Regressão:` e `Tela no app:` (S-10)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo. Não mexer na trava nem em `gravarConfiguracao`.

## O que NÃO decidir
Nada de regra do grupo; só o descrito acima.
