# Briefing appmel-1.14 — Retomar a conexão sem convite novo

BASE: a5cb558b9afc0d95443b71b64fa932c1572ab06b · RAMO: roadmap/appmel-1.14 · MODELO: opus (gatilho: segurança da rede/convite do cartório; risco alto, triagem pede duas lentes)
SKILLS: using-superpowers, qualidade-sabre, impeccable, sysdesign-resilience-failure
LEIA: qualidade-sabre §integridade, §seguranca (cartório e convites, segredos), §interface
TRIAGEM: M1 (+M4 cartório, +M5 botão) ~150 linhas, risco alto. Reaproveitar: services/cartorio/src/banco.ts:261 entrarPeloConvite (ramo de repetição já revoga token antigo e devolve outro, mesma chave_pub_def; convite.test.ts:361); convite.ts:73 entrarNoGrupo; apps/desktop/src/main/entrada-no-grupo.ts:176-192 (usarConvite + ErroDepoisDoConvite); boas-vindas.ts:160-190 entrar(); ui/boas-vindas.ts + ui/ponte.ts. NÃO escrever: tabela/coluna nova (janela = agora - usado_em), endpoint novo, chave privada ou token em disco antes do sucesso, mudança em criarConviteDono/validade. Passos: (1) banco.ts ramo de repetição recusa se agora - usado_em > 30 min; (2) boas-vindas.ts guarda convite+chaves EM MEMÓRIA com o instante do uso quando falha com conviteGasto, "Tentar de novo" reusa; (3) botão só nesse estado de erro, com estado de carregando. Os arquivos do item (boas-vindas.ts, entrada-no-grupo.ts) estão incompletos: a mudança real inclui services/cartorio/src/banco.ts e convite.ts. Estimativa com margem (app-1.3b estourou 4x).

## Item (texto literal do roadmap)
**1.14 — Retomar a conexão sem convite novo.** Se a troca do túnel falha depois do convite gasto, hoje o assistente manda pedir convite novo; guardar o estado para "tentar de novo a conexão".
Arquivo: apps/desktop/src/main/boas-vindas.ts, entrada-no-grupo.ts (+ services/cartorio/src/banco.ts, convite.ts).
**Tela no app:** botão "Tentar de novo" no assistente.
Confirmação: teste: falha na instalação definitiva, depois sucesso sem novo convite.

## Decisões que valem para este item
- 01/11 (Eliel, DECISOES.md): o cartório pode reemitir o pacote da conexão SÓ para o mesmo PC que gastou o convite (mesma chave pública), e SÓ até 30 min depois do uso; passou disso, convite novo.
- Decidido pela onda (reversível): "Tentar de novo" vale só enquanto o app estiver aberto; o estado fica em memória, nunca em disco (chave privada). Fechou o app ou passou 30 min: pede convite novo.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.14.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois): cartório — mesma chave aos 29 min reemite (token e pacote novos, token antigo revogado); aos 31 min recusa; chave diferente recusa. App — falha após o cartório aceitar, "Tentar de novo" reusa convite+chaves e entra.
- [ ] Teste de recusa sem vazar informação diferente entre "janela vencida" e "chave errada" (mesma resposta)
- [ ] `npm run vistoria` APROVADA (e `npm run vistoria:comum` se tocar infra/ ou tests/infra/)
- [ ] PR com as seções do modelo, as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento e as linhas **Regressão:** e **Tela no app:** (S-10)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Mudar a janela de 30 min ou a regra "mesmo PC"; persistir chave/token em disco.
