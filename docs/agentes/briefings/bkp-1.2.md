# Briefing bkp-1.2 — Pacote fechado e conferido

BASE: 488075c91af957e4e05d174a673253fd878d34cf · RAMO: roadmap/bkp-1.2 · MODELO: sonnet (esforço alto; revisão com duas lentes) · ISSUE: #34
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §2 e §4; references/seguranca.md §3; references/desempenho.md
TRIAGEM: M6 (pacote `tar` + `node:zlib` gzip) · ~90 linhas de cola (+~150 teste; real provável ~1,5×) · risco ALTO ·
MIÚDO: não. REAPROVEITAR: `backup/manifesto.ts` (`gerarManifesto`, `validarManifesto` — já recusa nomes inválidos no
Windows —, `compararManifestos`), `integridade/hash.ts` (`hashDoArquivo`, `hashComTamanho`, em fluxo), mundos de teste
de `test/ajuda/mundos.ts`. NÃO ESCREVER: formato de arquivo próprio; zip; troca atômica/rename do mundo (é bkp-2.2 e
sync); hash próprio; pool de workers genérico. PASSOS: 1) `criarPacote(pastaDoMundo, destino, {versao, epoca})`:
gera o manifesto, escreve `manifesto.json` como PRIMEIRA entrada e depois os arquivos NA ORDEM do manifesto, em
`<destino>.parcial` + rename; devolve {caminho, sha256 do pacote, tamanho}; compactação fora da linha principal
(worker_threads ou o stream do zlib, provando que o laço de eventos não trava) e prioridade baixa quando possível
(`os.setPriority` no worker; ignore erro de permissão); 2) `abrirPacote(pacote, sha256Esperado, pastaTemporaria)`:
confere o hash do pacote ANTES de abrir; lê `manifesto.json` e passa por `validarManifesto`; extrai só entradas do tipo
arquivo comum cujo caminho está no manifesto (recusa link simbólico, link físico, dispositivo, caminho absoluto, `..`,
entrada fora do manifesto ou repetida); confere tamanho e SHA-256 de cada arquivo; arquivo do manifesto ausente no
pacote → recusa; qualquer falha → apaga a pasta temporária inteira e lança erro pt-BR.
PROVA: pacote com 1 byte trocado recusado (antes de extrair); pacote com entrada `../x`, link simbólico e arquivo fora
do manifesto recusados (monte esses pacotes maliciosos no teste com o próprio `tar`); falha no meio apaga a temporária;
ida e volta com mundo de 20 MB reproduz os mesmos hashes; durante o empacotamento do mundo de 20 MB o laço de eventos
continua respondendo (meça o maior intervalo entre ticks de um setInterval de 10 ms e diga no PR).

## Item (texto literal do roadmap)
- [ ] **1.2 — Pacote fechado e conferido**
  *O que fazer:* gerar pacote (zip ou tar.zst, escolher pelo desempenho e registrar) com o manifesto dentro; abrir e
  conferir todos os hashes; compactação em worker com prioridade baixa.
  *Arquivo:* `packages/nucleo/src/backup/pacote.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: pacote corrompido (1 byte) é recusado; mundo de 20 MB empacota sem travar o processo.
  *Depende de:* bkp-1.1

## Decisões que valem para este item
- **Decidido pela Máxima (reversível):** formato `.tar.gz` com o pacote npm `tar` (licença ISC, mantido pelo time do
  npm) — zstd não é estável no Node 22. Registre a dependência em `docs/ops/DECISOES.md` (só em `packages/nucleo`).
- Regras de ouro 2, 3 e 6: este item não lê o mundo com servidor rodando (quem chama faz o `salvarSeguro`), nunca
  escreve na pasta do mundo (só na temporária) e só usa mundos de teste.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkp-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); `git status` limpo e /tmp sem sobras depois do `npm test`
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #34` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
