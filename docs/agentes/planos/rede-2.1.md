# Plano rede-2.1 — Velocity com whitelist e modern forwarding

Briefing: `docs/agentes/briefings/rede-2.1.md` (ramo da Máxima). Issue #46. Triagem M3 + M7, ~150 linhas (+~150 teste).

## Arquivos
- `infra/vps/instalar-velocity.sh` — script irmão do `instalar.sh` (mesmo molde: `SABRE_SIMULAR`, `SABRE_ESTADO`,
  `executar`, `gravar`, `ja_feito`). Passos, todos idempotentes:
  1. confere root, Ubuntu e que o usuário `sabre` já existe (criado pelo `instalar.sh`);
  2. valida `SABRE_DESTINO` (padrão `10.66.0.2:25565`): só `10.66.0.2`–`10.66.0.254` e porta 1–65535;
  3. baixa o jar pela API oficial do PaperMC (versão fixada), lê URL + SHA-256 do JSON, baixa para pasta temporária,
     **confere o hash antes de usar**; hash errado → apaga e para; só então instala em `/opt/sabre/velocity/` (dono root);
  4. gera o segredo de forwarding uma vez (48 bytes aleatórios em base64, `umask 077`, dono `sabre`, modo 600, nunca
     impresso; se o arquivo existe, não regenera);
  5. grava `velocity.toml` (só se ainda não existe — o rede-2.2 troca o destino) e `whitelist.txt` vazio;
  6. instala `sabre-velocity.service` (DESLIGADA: sem `enable`).
- `infra/vps/systemd/sabre-velocity.service` — usuário `sabre`, sandbox como o `sabre-proxy.service`.
- `infra/vps/velocity/LEIAME.md` — campos do toml, whitelist (Velocity não tem nativa), mod de forwarding do NeoForge,
  limites e o que fica para rede-2.2/2.3.
- `tests/infra/instalar-velocity.test.ts` — testes em simulação (jar vem de `file://` falso; só em simulação).
- `infra/vps/teste/Dockerfile` — inclui o novo script no `bash -n` e `shellcheck`.

## Testes (antes do código)
1. toml tem `bind = "0.0.0.0:25565"`, `online-mode = true`, `player-info-forwarding-mode = "modern"`,
   `force-key-authentication = true`, `forwarding-secret-file`, `[servers]` + `try`; nenhum `forwarding-secret =`
   com valor; nada de 0.0.0.0 no destino.
2. destino fora de `10.66.0.2–254` (público, 192.168, 10.66.0.1, 10.66.1.5, porta 0/70000, texto estranho) é recusado.
3. 2ª rodada não regenera segredo, toml, whitelist nem baixa o jar de novo.
4. hash conferido antes de `install` do jar; hash errado → erro, sem `install`; URL `http://` recusada.
5. segredo: `umask 077`, dono `sabre`, `chmod 600`; o comando não contém o valor; unidade nunca habilitada.

## Fora do escopo
Plugin que troca o host (rede-2.2), sala de espera (rede-2.3), plugin de whitelist, mod de forwarding no host.
