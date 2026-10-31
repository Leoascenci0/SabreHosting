# Plano rede-2.3 — Sala de espera (limbo)

Método: M3 (molde do `instalar-velocity.sh`). ~120 linhas de script/unidade/LEIAME + ~150 de teste. Risco médio-alto
(serviço de rede). Sem acesso à internet/GitHub nesta sessão: o hash do binário não pode ser conferido aqui.

Escolha: **PicoLimbo** (Quozul, licença **MIT**), programa separado, só baixado e executado na máquina da nuvem;
nada dele entra no repositório. Escolhido sobre o NanoLimbo (GPL-3.0) por licença permissiva e sem Java.

1. Teste primeiro (`tests/infra/instalar-limbo.test.ts`), falhando: simulação 2x idempotente; hash errado recusado;
   hash não fixado recusado; bind só `127.0.0.1`; porta interna fora de qualquer `ufw`; segredo nunca impresso;
   unidade desligada; `velocity.toml` com o servidor `espera`.
2. `infra/vps/limbo/instalar-limbo.sh`: mesmas funções do molde (simulação, `ja_feito`, download temporário,
   SHA-256, `install` atômico). Versão, URL e hash vêm de `infra/vps/limbo/limbo-release.env` (vazio até o Eliel/
   Máxima fixar a release; script recusa hash vazio). Config `server.toml` modo 600 com o segredo lido do arquivo do
   Velocity (substituição na gravação; a simulação mostra só o marcador).
3. `infra/vps/systemd/sabre-limbo.service`: User=sabre, endurecida, instalada desligada.
4. `instalar-velocity.sh`: acrescenta `espera = "127.0.0.1:25566"` em `[servers]` (sem mudar `host` nem `try`); o
   limbo.sh acrescenta a linha se o toml já existir sem ela.
5. LEIAME do limbo + linha em `docs/ops/DECISOES.md` (escolha e licença); ajusta "Não feito" do LEIAME do Velocity.

Fora: plugin que move os jogadores (rede-2.2), abrir qualquer porta, rodar na máquina real.
