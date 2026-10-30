# Desempenho

O PC do host também está jogando. O app não pode roubar desempenho do jogo.

## 1. Metas (tetos em `scripts/limites.json`; só descem)

- App parado na bandeja: < 150 MB de RAM, CPU ~0%.
- Troca de host: tela de carregamento < 20 s com mundo de 1 GB e 50 Mbps.
- Backup não causa queda de TPS perceptível (compactação em processo separado, prioridade baixa).

## 2. Regras

- **Ler em fluxo (stream)**, nunca o mundo inteiro na memória.
- **Delta por região:** só o que mudou viaja.
- **Compactação** em processo/worker separado, prioridade baixa (`os.setPriority`), nível rápido.
- **Servidor:** Paper (ou Fabric + Lithium/C2ME, decisão D5), flags de JVM conhecidas (Aikar), RAM pela nota do PC,
  `simulation-distance` menor que `view-distance`, mapa pré-gerado (Chunky).
- **Tela nunca trava:** trabalho pesado no `nucleo` (processo principal/worker), a tela só recebe progresso.

## 3. Como provar

- Teste de transferência com mundo de teste mede tempo e bytes enviados (delta < total).
- `npm run vistoria` roda as medidas e compara com `scripts/limites.json`.
