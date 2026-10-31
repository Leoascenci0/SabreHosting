# Briefing lancmel-1.1 — Detecção e instância mais firmes (parte a e b)

BASE: 2eb719fe795887ca8b86bb8bf5f4c3a046bc0cba · RAMO: roadmap/lancmel-1.1 · MODELO: haiku (MIÚDO)
ISSUE: #113
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1
TRIAGEM: M4 | ~40 linhas + ~40 de teste | RISCO baixo | MIÚDO: sim | REAPROVEITAR: packages/nucleo/src/launcher/instancia.ts:40-49 nomeSeguroDoGrupo (corte em :42); instancia.ts:125 readFile(...).catch; prism.ts:8-11 SistemaArquivos (molde de leitor injetável) | NÃO ESCREVER: comparação de versão completa (VERSAO_MINIMA=8 é inteiro; a condição "mínimo virar 8.x" não ocorreu: registrar no PR); marcador próprio (adiado, ver decisão); mexer em execReal/ExecArquivo (prism.ts:13-14, :159; rede/wireguard.ts importa) | PASSOS: 1. instancia.ts:42: cortar por ponto de código (Array.from(nome).slice(0, MAX_NOME).join("")), teste com grupo de 63 letras + emoji (antes termina em par substituto solto); 2. instancia.ts:125: catch só para ENOENT, demais erros repassados; leitor injetável para provar que erro não-ENOENT propaga e nada é gravado | PROVA: testes falham antes e passam depois; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.1 — Detecção e instância mais firmes**
  *O que fazer:* comparar a versão completa do Prism (major.minor.patch) se o mínimo virar 8.x; marcador próprio da
  instância do SabreHosting (arquivo dentro da pasta) além do nome; cortar o nome do grupo sem partir emoji (par
  substituto); `readFile(...).catch` só para "não existe", repassando outros erros.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`, `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* lanc-1.1 · PR #36 e lanc-1.2 · PR #57 · qa

## Decisões que valem para este item
- Decidido pela Máxima (reversível): o **marcador próprio da instância fica para o lanc-1.3**, que é quem vai ler a instância; hoje ninguém o leria. A comparação major.minor.patch só se o mínimo virar 8.x (não virou). Registre os dois em "O que NÃO foi feito" no PR.
- Nunca copiar código do Prism (GPL-3.0); só comportamento e formato documentados.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/launcher/instancia.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Refs #113 — o item segue aberto pelo marcador) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), segredo. Nada fora de packages/nucleo/src/launcher/instancia.ts e o teste dele.

## O que NÃO decidir (perguntar à orquestradora)
nada
