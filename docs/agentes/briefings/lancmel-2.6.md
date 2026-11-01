# Briefing lancmel-2.6 — Extrair o Java baixado e apontar o javaw

BASE: 9750ed4f426eb5843719e1fa6d893ed33f6a284a · RAMO: roadmap/lancmel-2.6 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade e §seguranca (download, zip slip)
TRIAGEM: M1+M3 · ~90 linhas + ~120 de teste · risco médio. REAPROVEITAR yauzl (já dependência do núcleo) e importar.ts:72-75,106,203-209 (regra de caminho '..'), montar.ts:302-314, packages/nucleo/test/ajuda/zip.ts (montarZip). NÃO ESCREVER leitor de zip próprio nem nova regra de '..'; nada do 2.7. Acrescentar recusa de link simbólico. Extrair em temporário, renomear, e só depois gravar o javaw no .montada.json (último a gravar). Nota: o item dizia 'sem yauzl'; vale a letra nova: reusar yauzl.

## Item (texto literal do roadmap)
- [ ] **2.6 — Extrair o Java baixado e apontar o `javaw`**
  *O que fazer:* `montar.ts` já baixa o zip do Java com hash conferido, mas não o extrai. Extrair para a pasta do cache (reusar o `yauzl` que já é dependência do núcleo e a regra de caminho de `importar.ts`; **sem dependência nova**), recusando entrada com `..`, caminho absoluto ou link simbólico (zip slip), extraindo para pasta temporária e renomeando só depois (regra 3), e gravar o caminho do `javaw` no marcador da instância.
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts` (e arquivo novo `zip.ts` ao lado, se passar de ~80 linhas)
  **Tela no app:** não se aplica.
  *Confirmação:* teste com zip falso gerado no teste: extrai, acha o `javaw`, recusa `../fora` e caminho absoluto, e uma falha no meio não deixa pasta pela metade. Versão real do Java no PC **[P: junto do lanc-2.3]**.
  *Origem:* lanc-2.3 · PR #240 · filha


## Decisões que valem para este item
nenhuma

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lancmel-2.6.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento (e Regressão: se for correção)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real dos amigos, qualquer segredo.

## O que NÃO decidir
nada
