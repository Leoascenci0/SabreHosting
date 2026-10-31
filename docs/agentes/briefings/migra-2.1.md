# Briefing migra-2.1 — Pré-cópia em segundo plano

BASE: ad790c3a6c67ca38d03323cb57e3eb29faee908d · RAMO: roadmap/migra-2.1 · MODELO: opus (gatilho: migração de host, autorizado pela coordenadora)
SKILLS: using-superpowers, qualidade-sabre, sysdesign-consistency-coordination, sysdesign-resilience-failure
LEIA: qualidade-sabre §1; integridade (trava de atualização, troca atômica, regras 1, 2, 3, 5); desempenho (medir sem baixar)
TRIAGEM: M1 (+M7 pequeno), ~60 linhas + ~80 teste, RISCO alto. REAPROVEITAR: espalhar() packages/nucleo/src/sync/espalhar.ts:112 (puxa a versão de PCs e do host; escolherFontes:60 põe host por último, aceita host); candidato não hospeda, então exigirForaDoHost (aplicar.ts:83) passa; decidirHost (migracao/decidir.ts:76) já exige versão mais nova para o candidato (= prontidão); compararManifestos (backup/manifesto.ts:206) + ArquivoDoManifesto.tamanho dão o delta em bytes. NÃO ESCREVER: nova rotina de download/hash/fontes; nova trava (usa a de atualização; a de host só entra em migra-2.2); cópia direta da pasta do host (A-01); reescolha de fontes; campo novo de prontidão (é a versão igual à mais nova). PASSOS: 1) precopia.ts: medirDeltaFinal(local, alvo) = soma de tamanho de novos+mudados (função pura, sem rede); 2) pedirPreCopia chama espalhar() no candidato com a versão e fontes do cartório e devolve {estado, bytesBaixados, deltaFinalBytes, porcento do mundo}; 3) testes com mundo inventado (tests/mundos/): host ativo como fonte, candidato parado, delta < 5% após pré-cópia. PROVA: teste 'após a pré-cópia, delta final < 5% do mundo de teste' + teste de que o espalhar recusa com servidor do candidato rodando. AVISO: o manifesto da versão atual do host só chega por `pedir` dentro de espalhar; medir o delta final sem aplicar exige buscar esse manifesto de novo (pequena duplicação) ou expor o manifesto de espalhar: escolha a mais simples e diga no PR. Contexto: PRs #192 (espalhar ligado ao app, trava de atualização) e #195 (o app serve a vitrine do último backup bom no IP 10.66.0.x); o host só serve o ÚLTIMO BACKUP BOM, não o mundo vivo — o delta final é o que mudou desde esse backup.

## Item (texto literal do roadmap, docs/roadmap-migra.md, item 2.1)
- [ ] **2.1 — Pré-cópia em segundo plano**
  *O que fazer:* o novo host puxa a versão atual enquanto o antigo joga; mede o tempo previsto do delta final.
  *Arquivo:* `packages/nucleo/src/migracao/precopia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: após a pré-cópia, delta final < 5% do mundo de teste.
  *Depende de:* migra-1.1, sync-1.2

## Decisões que valem para este item
D6: nota do PC ≥ 1,3 × a do host para trocar. Trava de atualização separada da de host (DECISOES 31/10). Mundo que roda nunca é tocado. Esta pré-cópia NÃO faz a troca de host (isso é migra-2.2, sozinho na onda): só prepara e mede. Qa com integridade + segurança obrigatório.

## Soluções conhecidas que se aplicam
S-01, S-06 (geração/token antes de qualquer await), S-07, S-09, S-10 (linhas Regressão:/Tela no app:), S-11 (não escreva a flag que pula o pre-commit, nem em heredoc), S-12. Vistorias uma de cada vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/migra-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo. Nada de troca de host, nada de tela.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
