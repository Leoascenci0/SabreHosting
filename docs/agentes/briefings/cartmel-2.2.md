# Briefing cartmel-2.2 — Revogar também o peer e provar a trava do PC revogado

BASE: 0b57326dda53d3c119a762fe962c38f0ca945bf7 · RAMO: roadmap/cartmel-2.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination
LEIA: qualidade-sabre › references/integridade.md (trava, prazo) e seguranca.md; docs/memoria/metodos-aprendidos.md L-01 (item de trava precisa da conta de tempo)
TRIAGEM: M1 (limitador de falhas e trava já existem; só teste novo + documentação) · ~25 linhas · risco alto por tocar cartório/trava, mas o diff é só teste e texto. Reaproveitar: servidor.ts:228-234 (limiteFalhas/soPc), servidor.ts:370-385 (POST /pcs/:id/revogar), banco.ts:284-297 (revogarPc) e :325 (pcDoToken filtra revogado), trava.ts:31-34 e :150-154, cartorio.test.ts:373-387 (padrão "token errado conta e vira 429"). Não escrever: remoção de peer do WireGuard (item de rede à parte, já decidido em DECISOES 31/10; a Máxima abre o item em roadmap-rede-melhoria.md no PR de controle), limitador novo, mudança de MAX_FALHAS/JANELA/prazo da trava. Passos: (1) teste em services/cartorio/src/cartorio.test.ts: dono revoga um PC, o token revogado usado até o limite dá 401 e a tentativa seguinte dá 429, mesmo com o token ativo de outro PC no mesmo IP; sem a asserção do 429 o teste deve falhar (prove); (2) docs/arquitetura.md §6: dizer que o host revogado perde a trava só no prazo; CORRIGIR o "~20 s": a renovação (a cada 20 s) é recusada sem token ativo e o servidor para; a trava vence no expira_em, até 60 s após a última renovação (trava.ts:31-34). Dúvida para o Eliel: nenhuma.

## Item (texto literal do roadmap)
Revogar também o peer e provar a trava do PC revogado. Hoje `POST /pcs/:id/revogar` só tira o acesso ao cartório; o peer do PC continua na rede privada (item de rede à parte, já decidido em DECISOES 31/10) — abrir esse item em `docs/roadmap-rede-melhoria.md` quando o ajudante do WireGuard estiver instalado; e documentar que o host revogado perde a trava só no prazo (~20 s).
Arquivo: `services/cartorio/src/`, `docs/`. Tela no app: não se aplica. Confirmação: teste de limite de falhas contando token revogado (429).
Nota da Máxima: `docs/roadmap-rede-melhoria.md` é da Máxima (fora do seu alcance); não o edite.

## Decisões que valem para este item
DECISOES 31/10 (cartmel-1.1): peer do WireGuard é item de rede à parte.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-2.2.md como primeiro commit
- [ ] Teste novo (falha sem a asserção, passa com o código atual) em services/cartorio/src/cartorio.test.ts
- [ ] docs/arquitetura.md corrigido (60 s vs 20 s)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
