# Plano rede-1.4 — Ajudante do WireGuard e sala de entrada

Método: M3 (+M1 nos validadores, +M7 em firewall e sudoers). ~180 linhas de script + ~220 de teste. Risco alto (root
via sudoers, firewall). Contrato do ajudante fixado no briefing (compartilhado com o cart-1.5): não muda.

1. Teste primeiro (`tests/infra/entrada.test.ts`, simulação): adicionar dá 200–254 e é idempotente pela chave; sala
   cheia = 1; trocar exige o provisório em estado `entrada`, aloca 2–199, mantém o provisório e repete o mesmo IP;
   remover só aceita 200–254 em `entrada` (sem peer = 0); comando fora da lista = 2; argumento torto = 1 sem mudar
   arquivo nenhum. Em `instalar.test.ts`: sudoers só com o caminho do ajudante (sem `*`, `visudo -cf` se houver),
   regras da sala nas `before.rules` (só `10.66.0.1:7710`, nada de repasse de/para 200–254), nenhuma porta nova na
   internet. Em `adicionar-pc.test.ts`: definitivos param em 10.66.0.199.
2. `infra/vps/wg/comum.sh` (novo, fonte comum): validadores, gravação atômica, lock, `proximo_ip <primeiro> <último>`,
   `sem_bloco <marca>`, conferência do `wg0.conf` por faixa e estado, cadastro do definitivo. `adicionar-pc.sh` passa a
   usar o comum sem mudar comportamento, exceto `ULTIMO=199` (desenho §5.4).
3. `infra/vps/wg/ajudante-entrada.sh`: `entrada-adicionar|entrada-trocar|entrada-remover`, conforme o contrato.
   Sob `sudo`, ignora as variáveis de simulação; endpoint lido de `/etc/sabre/hub.env` (root).
4. Segurança achada no desenho: o registro `pcs.tsv` hoje fica em `/var/lib/sabre` (dono `sabre`); com root
   escrevendo lá a pedido do `sabre`, um link simbólico viraria escrita como root. O registro vai para
   `/var/lib/sabre-wg` (root, 700); o instalador muda o arquivo antigo de lugar uma vez.
5. `instalar.sh`: copia o ajudante para `/opt/sabre/wg` (root, 755), grava `/etc/sudoers.d/sabre-entrada` (440,
   conferido por `visudo -cf` antes), regras da sala nas `before.rules` do ufw (`-m iprange`), libera `7710/tcp` só
   em `wg0` para `10.66.0.1`; `ufw route allow in on wg0 out on wg0` continua para os definitivos (a sala é barrada
   antes, nas `before.rules`).
6. `LEIAME.md`: faixas, ajudante, sudoers, firewall da sala, registro novo.

Fora: cartório (cart-1.5), máquina real, porta nova na internet.
