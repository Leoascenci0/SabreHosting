# Briefing redemel-1.1 — Rede privada mais rígida

BASE: b5ad32ddd99e24297c1b33db7f1d422751a4b59f · RAMO: roadmap/redemel-1.1 · MODELO: opus (gatilho: segurança da rede)
ISSUE: #112
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (rede); §enxugar
TRIAGEM: M4 + M1 | ~60 linhas + ~90 de teste | RISCO alto | MIÚDO: não | REAPROVEITAR: validarPacote (packages/nucleo/src/rede/wireguard.ts:59) para a faixa de porta; montarConfigDoPc (wireguard.ts:84) como fonte da lista permitida; PROIBIDO_NA_CONFIG (wireguard.ts:101); endpoint_valido (infra/vps/wg/comum.sh:52); ip_na_faixa (comum.sh:55); mktemp em comum.sh:63/:121 com rm -f em :132 | NÃO ESCREVER: parser novo de config (comparar linha a linha com as chaves/valores que o montador produz); validação nova de IP/chave (chaveValida/validarPacote existem) | PASSOS: 1. testes falhando: config com linha extra (ex. AllowedIPs 0.0.0.0/1, 128.0.0.0/1; PostUp; DNS) e porta 0 (wireguard.test.ts, bloco aplicarNoWindows); 2. aplicarNoWindows aceita só o que montarConfigDoPc produz (lista do permitido); 3. finally com rm em try/catch que não esconde o erro original; 4. porta 1–65535 em validarPacote e em endpoint_valido; 5. trap de limpeza onde há mktemp | PROVA: casos novos falham antes, passam depois; SABRE_SIMULAR=1 para o hub; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.1 — Rede privada mais rígida**
  *O que fazer:* `aplicarNoWindows` aceita só o texto exato que `montarConfigDoPc` produz (lista do que é permitido, não
  do que é proibido — hoje `0.0.0.0/1, 128.0.0.0/1` passaria se alguém chamasse sem o montador); o `rm` do `finally` não
  esconde o erro original; no hub, porta 0 recusada no endpoint e `trap` para limpar os temporários do `mktemp`.
  *Arquivo:* `packages/nucleo/src/rede/wireguard.ts`, `infra/vps/wg/adicionar-pc.sh`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* rede-1.3 · PR #60 · qa

## Decisões que valem para este item
- Decidido pela Máxima: pode editar também `infra/vps/wg/comum.sh` — desde o rede-1.4 os validadores e o mktemp do adicionar-pc.sh moram lá (é a mesma regra, só mudou de arquivo). Não mude o comportamento do ajudante-entrada.sh/ajudante-socket.sh além do que a validação comum exigir.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/redemel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/rede/ e tests/infra/
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #112) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, segredo. Nada em servidor/, apps/desktop, .github (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
nada
