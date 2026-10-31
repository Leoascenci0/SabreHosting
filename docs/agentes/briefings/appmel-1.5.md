# Briefing appmel-1.5 — Retomar a própria trava depois de reabrir o app

BASE: 66cd79f60b0d9eb122837041b1fb5ffbf3a34c1b · RAMO: roadmap/appmel-1.5 · MODELO: opus (gatilho: lógica de trava de host, regra de ouro 1)
ISSUE: #98
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre §1; §integridade (trava de host, regra 1); lição L-01 em docs/memoria/metodos-aprendidos.md
TRIAGEM: M4 (correção pontual, M1 de cliente.eu()) | ~30 linhas + ~60 de teste | RISCO alto (trava de host) | MIÚDO: não | REAPROVEITAR: apps/desktop/src/main/inicio.ts:112-127 (estado(): hoje mostra "outro" quando o dono é este PC); packages/nucleo/src/cartorio/cliente.ts:177 (eu(), GET /eu, já existe); apps/desktop/src/main/deps-reais.ts:40 (lerTrava; eu entra no mesmo molde); services/cartorio/src/trava.ts (pegar já aceita dono = este PC, então "Hospedar" sobe sem esperar os 60 s); apps/desktop/src/main/fake-e2e.ts:15 (MEU_ID) | NÃO ESCREVER: nada no cartório (services/cartorio intocado; nada de /trava/soltar); tela ou texto novos (estado "ninguem" já mostra Hospedar); nada no renovador nem no núcleo; não reescrever esperarTravaLivre | PASSOS: 1. DepsInicio ganha eu(); depsReais implementa com exigir().eu(); 2. em estado(): se lerTrava().dono.id === eu().id e não há ativo nesta sessão, devolver {tipo:"ninguem"}; falha no eu() mantém o comportamento atual ("outro"); 3. antes de liberar o "Hospedar", conferir que não há servidor órfão vivo nesta pasta (ver decisão); se houver, não oferecer | PROVA: inicio.test.ts "dono sou eu sem servidor vira ninguém" (falha antes, passa depois) + "dono sou eu com órfão vivo não oferece Hospedar"; cenário E2E "dono sou eu, sem servidor" (fake-e2e MEU_ID); deps-reais.test.ts para eu.

## Item (texto literal do roadmap)
- [ ] **1.5 — Retomar a própria trava depois de reabrir o app**
  *O que fazer:* se este PC é dono da trava mas o app foi reaberto sem servidor rodando, a tela mostra "Servidor no PC do
  <este PC>" até a trava vencer (~60 s). Reconhecer "dono sou eu, sem servidor" e soltar a trava (ou oferecer "Hospedar"
  de novo pelo `hospedar()`).
  *Arquivo:* `apps/desktop/src/main/inicio.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* E2E com cenário "dono sou eu, sem servidor".
  *Origem:* app-1.2 · PR #74 · filha + qa (baixa-média)

## Decisões que valem para este item
- Decidido pela Máxima (regra de ouro 1, lado seguro): servidor órfão de sessão anterior (app fechado à força com o Java vivo) **é caso a cobrir**. Na dúvida, não oferecer "Hospedar": mostrar o estado atual ("Servidor no PC de <este PC>") até a trava vencer. Detecção pela forma mais simples e confiável que já houver no código (ex.: `session.lock` do mundo preso pelo Java, ou registro do PID gravado ao subir); se exigir algo grande, implemente só o passo 1–2 com a guarda conservadora (órfão incerto → não oferece) e descreva a detecção completa em "Melhorias encontradas".
- A prova real no PC Windows (fechar o app à força com o servidor no ar e reabrir) fica **[P]** para o Eliel: escreva no PR, em "O que NÃO foi confirmado", o passo a passo de 5 linhas para ele testar.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.5.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em apps/desktop/src/main/ e no E2E
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #98) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas pela vistoria), máquina da nuvem real, mundo real, qualquer segredo. Nada em services/cartorio,
infra/vps, packages/nucleo/src/servidor (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada
