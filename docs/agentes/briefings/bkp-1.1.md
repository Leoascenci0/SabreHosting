# Briefing bkp-1.1 — Manifesto do mundo

BASE: 88db9287f01a644ac6475348d42b30d8c4835564 · RAMO: roadmap/bkp-1.1 · MODELO: sonnet · ISSUE: #18
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §2, §3 e §6; references/desempenho.md (leitura em fluxo)
TRIAGEM: M1 (hash em stream) + M7 (manifesto e comparação) · ~120 linhas (+~100 teste) · risco ALTO (base do delta)
· MIÚDO: não. REAPROVEITAR: `packages/nucleo/src/servidor/baixar.ts` `hashDoArquivo` (privada): mova para
`packages/nucleo/src/integridade/hash.ts` (exportada, com o algoritmo como parâmetro) e faça `baixar.ts` importar
de lá, **sem mudar comportamento** (os testes de baixar continuam verdes, sem editar). Gerador de mundos de teste:
`packages/nucleo/test/ajuda/mundos.ts` (gerarMundo, mudarRegioes, corromperArquivo). NÃO reaproveitar
`hashesDoMundo` (helper de teste, lê o arquivo inteiro). NÃO ESCREVER: novo leitor de hash; zip/pacote (é o bkp-1.2);
cópia do mundo. PASSOS: 1) mover `hashDoArquivo`; 2) `gerarManifesto(pastaDoMundo, {versao, epoca, agora})`:
percorre em fluxo (`opendir`/recursivo, um arquivo por vez), caminhos relativos com `/`, ordenados, tamanho e
SHA-256; ignora links simbólicos (recusa e avisa) e o `session.lock`; 3) recusar caminho com `..`, absoluto ou com
`\\` ao ler um manifesto de fora (`validarManifesto`); 4) `compararManifestos(a, b)` → {novos, mudados, apagados}.
PROVA: mundo de teste de 1 MB: muda 2 regiões → `mudados` aponta só as 2; arquivo novo/apagado aparecem; manifesto
com `../x`, `/etc/x` ou `C:\\x` recusado; mesma pasta → mesmo manifesto (determinístico, menos a data); o mundo de
20 MB não entra inteiro na memória (hash em fluxo; diga no PR como provou).

## Item (texto literal do roadmap)
- [ ] **1.1 — Manifesto do mundo**
  *O que fazer:* percorrer a pasta do mundo em fluxo e gerar `manifesto.json` (caminho relativo, tamanho, SHA-256 de
  cada arquivo; versão; época; data). Recusar caminhos com `..`/absolutos. Comparar dois manifestos → lista do que
  mudou (base do delta).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com mundos de teste: muda 2 regiões → diff aponta só as 2.
  *Depende de:* base-1.3

## Decisões que valem para este item
- Regra de ouro 2: este item **só lê**; nunca copia nem escreve na pasta do mundo. A leitura com o servidor rodando é
  responsabilidade de quem chama (bkp-1.3 faz o `save-off`); documente isso no topo do módulo.
- Regra de ouro 6: só mundos gerados pelo `mundos.ts`.
- Formato do `manifesto.json`: `{ formato: 1, versao, epoca, criadoEm, arquivos: [{caminho, tamanho, sha256}] }`
  (decidido pela Máxima; reversível).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkp-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/; testes de baixar intactos e verdes
- [ ] `npm run vistoria` APROVADA; `git status` limpo depois do `npm test`
- [ ] PR com as seções do modelo, `Closes #18` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
