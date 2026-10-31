# Plano cartmel-1.7 — Segredo do cartório num arquivo de ambiente

Método: M1 + M7 pequeno. Sem mudança no código do cartório; sem rotação de segredo.

1. `infra/vps/gerar-segredo.sh <arquivo>`: se o arquivo já existe e não está vazio, não faz nada (idempotente); senão
   cria com `umask 077`, modo 0600, conteúdo `SABRE_CARTORIO_SEGREDO_ADMIN=<openssl rand -hex 32>`. Nunca imprime o valor.
2. `instalar.sh` (seção 6): cria `/etc/sabre` e chama o script por `executar` (root:root, 0600). Na simulação só aparece o
   comando, nunca o segredo.
3. `sabre-cartorio.service`: `EnvironmentFile=/etc/sabre/cartorio.env` (systemd lê como root, antes de largar para `sabre`).
4. Teste (`tests/infra/instalar.test.ts`): script real em pasta temporária (0600, 2ª execução mantém, 64 hex, saída sem o
   segredo) e a simulação do instalador (chama o script na 1ª vez, não na 2ª; saída sem segredo); unidade traz o EnvironmentFile.
5. LEIAME de `infra/vps`: onde ler o segredo (`sudo cat /etc/sabre/cartorio.env`), sem valor.
