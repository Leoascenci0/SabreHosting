# Integridade do mundo

O mundo é o "banco de dados" do projeto. Perder ou bifurcar o mundo é o pior defeito possível.

## 1. Trava de host (lease)

- O cartório guarda **uma** trava: `{host, versao_base, expira_em, epoca}`. Pegar a trava é operação atômica no
  SQLite (`UPDATE … WHERE expira_em < agora OR host = eu`), nunca "ler e depois escrever".
- Prazo curto (~60 s), renovação a cada ~20 s. Sem renovar, a trava expira sozinha (host que caiu libera).
- **Época (fencing token):** cada vez que a trava muda de dono, `epoca` sobe. Todo envio de versão ao cartório leva a
  época; o cartório recusa época velha. Assim um host "zumbi" que voltou da hibernação não sobrescreve o mundo novo.
- Perdeu a trava com o servidor rodando: `save-all`, avisa no chat do jogo, para o servidor. Nunca continuar sem trava.

## 2. Backup consistente

1. `save-off` → `save-all flush` (esperar a resposta no RCON/console) → copiar → `save-on`.
2. O pacote é um zip (ou tar.zst) com `manifesto.json`: versão, época, data, hash SHA-256 de cada arquivo e do pacote.
3. Sobe para os destinos só depois de conferido localmente (abrir o zip e bater os hashes).

## 3. Versões e delta

- Versão = número inteiro que só cresce, dado pelo cartório no envio aceito.
- Delta por arquivo de região (`r.X.Z.mca`): manda só arquivo cujo hash mudou desde a versão que o outro tem.
- Quem recebe aplica numa **pasta temporária** cópia da versão anterior, confere o manifesto inteiro, e só então troca
  a pasta (`rename`). Falhou no meio: apaga a temporária, a versão anterior continua intacta.

## 4. Rotação e restauração

- Manter sempre: os N mais recentes + 1 por dia dos últimos 7 (N e os 7 são Configurações). Rotação nunca apaga o
  último backup que passou na conferência.
- Restaurar: (1) backup do estado atual, (2) pegar a trava, (3) trocar a pasta, (4) avisar o cartório com versão nova.
  Restaurar é decisão do Eliel/grupo: o app pede confirmação com o nome e a data do backup.

## 5. Migração de host

- Ordem fixa: pré-cópia em segundo plano → aviso no chat → `save-all` + parada do antigo → delta final → antigo
  libera a trava **passando** para o novo (época +1) → novo sobe → proxy move os jogadores.
- Em qualquer falha antes do novo subir: o antigo **retoma** (ainda tem o mundo completo). Nunca dois servidores com
  o mesmo mundo.

## 6. Como provar (testes)

- Teste de trava com dois "PCs" simulados disputando ao mesmo tempo (só um ganha).
- Teste de host zumbi: época velha recusada.
- Teste de queda no meio do delta: pasta original intacta.
- Teste de rotação: nunca sobra zero backup bom.
- Mundos de teste em `tests/mundos/` (gerados por script, pequenos).
