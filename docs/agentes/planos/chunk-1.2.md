# Plano chunk-1.2 — Núcleo: planejar o reset (prévia, sem apagar nada)

Método: M7 (+M1), só cálculo; nada é escrito no mundo. Reaproveita `listarRegioes` (regioes.ts), o `Leitor` de `nbt.ts`
e `test/ajuda/regiao-mca.ts`.

## Passos (TDD, um commit por passo)
1. `regioes.ts`: `RegiaoLida` ganha `setoresDosChunks` (paralelo a `chunks`, byte 3 da tabela); comentário sobre a janela
   lstat→open; testes: setores lidos, DIM-1/DIM1 como link simbólico ignorado (menores do qa do 1.1).
2. `nbt.ts`: `lerSpawnDoLevelDat` (formato antigo `Data.SpawnX/SpawnZ`, novo `Data.spawn.pos`), mesmo teto de bytes.
3. `mundo/planejar-reset.ts`: `planejarReset(pasta, dimensao, area, {confirmado})`.
   - Área: retângulo em chunks (`{tipo:"retangulo", x1,z1,x2,z2}`, cantos em qualquer ordem) ou ponto + raio em blocos
     (`{tipo:"raio", x, z, raio}`; entram os chunks que tocam o círculo).
   - Limites: chunk ±1874999, bloco ±29999984; não inteiro/NaN/Infinity/texto/fora do limite → `ErroDoPlanoDeReset`
     (`area-invalida`, texto fixo, sem eco do valor).
   - Teto sem confirmar: 1024 chunks e raio 1000 (constantes exportadas); acima disso `confirmacao-necessaria`
     (leva `chunksNaArea`) até vir `confirmado: true`.
   - Plano: chunks existentes (region), regiões tocadas, arquivos que mudam (region/entities/poi) com chunks
     afetados/restantes, arquivo apagado inteiro (só então o tamanho em bytes), setores que o Minecraft pode
     reaproveitar (arquivo que fica), avisos (ponto de nascimento, regiões apagadas inteiras, level.dat ilegível).
   - Só varre cabeçalhos via `listarRegioes`; testa cada chunk existente contra a área (sem iterar a área toda).
4. Testes: área vazia, parcial, região inteira, coordenada negativa, valores tortos, teto/confirmação, spawn nos dois
   formatos, raio, não escreve (hash do mundo igual).
5. `npm run vistoria`, PR.
