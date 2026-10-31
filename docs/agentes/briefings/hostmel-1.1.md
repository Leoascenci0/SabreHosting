# Briefing hostmel-1.1 — Hashes fixados por versão

BASE: bae01ec206fa4f726c0cdae5028922f943db0b1a · RAMO: roadmap/hostmel-1.1 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #100
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (download e hash); §enxugar
TRIAGEM: M1 (+M2 para a tabela) | ~60 linhas + ~80 de teste | RISCO alto (download + hash) | MIÚDO: não | REAPROVEITAR: resolverNeoForge (packages/nucleo/src/servidor/resolvedores.ts:43, hoje confia só no sidecar .sha1); alvo/HEX (resolvedores.ts:8-20); HashEsperado (baixar.ts:9); baixarConferido (baixar.ts:199, sem mudança) | NÃO ESCREVER: função nova de download, checagem nova em baixar.ts, módulo de rede | PASSOS: 1. tabela HASHES_NEOFORGE (versão → sha) em resolvedores.ts ou arquivo irmão; 2. resolverNeoForge recusa se a versão não está na tabela ou se o sidecar diverge (pt-BR); 3. testes: sidecar adulterado recusado; versão sem entrada recusada; ../-x seguem recusados | PROVA: resolvedores.test.ts (falha antes, passa depois); vistoria APROVADA | REDE: piston-meta.mojang.com e maven.neoforged.net dão 403 aqui — não tente baixar.

## Item (texto literal do roadmap)
- [ ] **1.1 — Hashes fixados por versão**
  *O que fazer:* tabela de hashes (NeoForge, Java) por versão, conferida pelo grupo, em vez de confiar só no sidecar
  `.sha1` do mesmo servidor do arquivo (protege contra servidor comprometido).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com sidecar adulterado recusado pela tabela.
  *Origem:* host-1.1 · PR #12 · filha

## Decisões que valem para este item
- Decidido pela Máxima (reversível): a tabela entra **vazia de valores reais** (só os testes usam hash fictício). Os valores reais entram quando o Eliel escolher a versão do Minecraft/NeoForge (pendente no MILESTONE) e o hash for tirado num PC com acesso — isso é [P]. Escreva no PR, em "O que NÃO foi confirmado", o passo a passo (comando de 1 linha para tirar o sha no PC e onde colar).
- Enquanto a tabela estiver vazia, versão sem entrada é recusada com mensagem pt-BR clara ("esta versão ainda não tem o hash conferido pelo grupo"); nunca cair para confiar só no sidecar.
- Se o item também falar do jar do Minecraft (Mojang), aplique o mesmo molde só se o resolvedor já existir; senão descreva em "Melhorias encontradas".

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/servidor/resolvedores.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #100) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, mundo real, segredo. Nada em comandos.ts/processo.ts nem apps/desktop (outros itens da onda).

## O que NÃO decidir (perguntar à orquestradora)
a versão do Minecraft/NeoForge (é do Eliel)
