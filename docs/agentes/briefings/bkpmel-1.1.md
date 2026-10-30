# Briefing bkpmel-1.1 — Caminhos do manifesto válidos no Windows

BASE: 3a82250f2279a037be638cf4f62c308a7dc3b3a1 · RAMO: roadmap/bkpmel-1.1 · MODELO: sonnet (esforço alto) · ISSUE: #25
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §3 e §5; references/integridade.md §3
TRIAGEM: M1 (`caminhoSeguro` e `validarManifesto` de manifesto.ts) + M7 pequeno · ~70 linhas (+~120 teste) · risco ALTO ·
MIÚDO: não. REAPROVEITAR: `manifesto.ts:caminhoSeguro` (já barra `\\`, drive, `..`, vazio, NUL), `validarManifesto`,
`percorrer` (já tem `aviso`), testes de caminho recusado como molde. NÃO ESCREVER: módulo novo de sanitização; de novo
as checagens de `..`/barra/drive. PASSOS: 1) em `caminhoSeguro`, por componente: nome reservado (CON, PRN, AUX, NUL,
COM1–9, LPT1–9, com ou sem extensão, sem diferenciar maiúscula), fim com ponto ou espaço, `<>:"|?*`, controle
0x00–0x1F; 2) em `validarManifesto`: colisão sem diferenciar maiúscula, limites em constantes (máx. 200 000 arquivos,
profundidade 32, caminho 240 caracteres), devolver objeto reconstruído só com os campos conhecidos; 3) em `percorrer`:
arquivo não comum (FIFO, socket, dispositivo) → aviso. **Também ao gerar:** `gerarManifesto` deve recusar (erro pt-BR)
um mundo local com nome que o Windows não aceita, para nunca publicar um pacote que outro PC não consegue extrair.
PROVA: um teste por caso (CON.txt, nul, COM1, "a.", "a ", "a:b", "a?b", R.mca + r.mca, profundidade 33, caminho de 241,
200 001 arquivos sem gerar 200 001 arquivos de verdade); campo extra descartado; FIFO avisado (pule o teste no Windows).

## Item (texto literal do roadmap de melhoria)
- [ ] **1.1 — Validar caminhos do manifesto para Windows (antes de o sync escrever em disco)**
  *O que fazer:* `validarManifesto` recusa nomes reservados do Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9, com ou sem
  extensão), ponto/espaço no fim do nome, `<>:"|?*` e caracteres de controle; recusa caminhos que colidem sem
  diferenciar maiúscula (`R.mca` e `r.mca`); limites de quantidade de arquivos, profundidade e tamanho do caminho;
  devolve objeto reconstruído, sem campos extras; arquivos não comuns (FIFO, socket) geram aviso em vez de serem
  pulados em silêncio. **Obrigatório antes do sync-1.2** (que escreve nesses caminhos).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com cada caso recusado; manifesto com campo extra volta sem ele.
  *Origem:* bkp-1.1 · PR #21 · qa segurança + qa integridade

## Decisões que valem para este item
- Regra de ouro 3 e 6; o sync (sync-1.2) vai escrever nesses caminhos em PCs Windows.
- Limites decididos pela Máxima (reversíveis): 200 000 arquivos, profundidade 32, caminho 240.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkpmel-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); testes existentes do manifesto intactos
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #25` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
