# Plano bkpmel-1.1 — Caminhos do manifesto válidos no Windows

Método: M1 (`caminhoSeguro`, `validarManifesto`, `percorrer` de `manifesto.ts`) + M7 pequeno. Risco alto: o sync-1.2
vai escrever nesses caminhos em PCs Windows (regras de ouro 3 e 6). Issue #25.

1. Testes primeiro (falham): um por caso em `manifesto.test.ts` — CON.txt, nul, COM1, "a.", "a ", "a:b", "a?b",
   R.mca + r.mca, profundidade 33, caminho de 241, 200 001 arquivos (lista sintética, sem criar arquivo), campo extra
   descartado, FIFO avisado (pulado no Windows), `gerarManifesto` recusa mundo com nome que o Windows não aceita.
2. `caminhoSeguro`: por componente, recusa nome reservado (com/sem extensão, sem diferenciar maiúscula), fim com
   ponto/espaço, `<>:"|?*` e controles 0x00–0x1F.
3. `validarManifesto`: constantes `MAX_ARQUIVOS=200000`, `MAX_PROFUNDIDADE=32`, `MAX_CAMINHO=240`; colisão sem
   diferenciar maiúscula; devolve objeto reconstruído só com os campos conhecidos.
4. `percorrer`: arquivo não comum (FIFO, socket, dispositivo) → `aviso`.
5. `gerarManifesto`: confere cada caminho antes de ler o conteúdo e fecha com `validarManifesto`, para nunca
   publicar pacote que outro PC não consegue extrair. Erro em pt-BR.
6. `npm run vistoria`, PR com `Closes #25`.
