# Plano migra-2.1 — Pré-cópia em segundo plano

Base ad790c3. Método M1 (+M7 pequeno). Sem troca de host (migra-2.2), sem tela, sem trava nova.

1. `medirDeltaFinal(local, final, bytesPorSegundo?)` (núcleo/migracao/precopia.ts), função pura sem rede: soma o
   `tamanho` dos arquivos novos e mudados de `compararManifestos(local, final)`; devolve arquivos, bytes, tamanho do
   mundo final, porcentagem e tempo previsto (bytes ÷ vazão medida na pré-cópia; `null` sem vazão).
2. `pedirPreCopia(opcoes do espalhar)`: chama `espalhar()` no candidato (versão e fontes do cartório; host aceito como
   fonte, por último) e cronometra. Devolve estado, bytes baixados, vazão e o manifesto local (a versão M que o
   candidato agora tem), base para medir o delta final quando o host fizer o último backup.
   Manifesto: `espalhar` passa a devolver o manifesto de M já conferido (1 linha), sem buscar de novo; em "já tinha",
   gera-se da pasta do candidato (servidor parado, fora do host, conferidos antes de ler).
3. Testes com mundo inventado de 20 MB: host ativo como fonte, candidato parado e atrasado; após a pré-cópia o host
   continua jogando (1 região muda, backup final M+1): delta final < 5 % do mundo (antes da pré-cópia ≈ 100 %).
   Candidato com servidor rodando: recusa, nada pego no cartório, mundo intacto.

Fora: troca de host, aviso no chat, trava de host, reescolha de fontes, cópia direta da pasta do host.
