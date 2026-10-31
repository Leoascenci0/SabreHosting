# Sala de espera (limbo) — instalação e limites

`sudo bash infra/vps/limbo/instalar-limbo.sh` (depois do `instalar-velocity.sh`). Pode rodar de novo: não baixa o
binário, não regrava a config nem a unidade. `SABRE_SIMULAR=1` só mostra o que faria.

## Escolha e licença

**PicoLimbo** (Quozul), licença **MIT**: servidor de Minecraft mínimo, sem mundo, que só segura o jogador. Escolhido
sobre o NanoLimbo (GPL-3.0) por licença permissiva e por não precisar de Java. É um **programa separado, só baixado e
executado** na máquina da nuvem: nada dele é copiado ou distribuído neste repositório.

## O que faz

- Lê versão, URL e SHA-256 de `limbo-release.env` (arquivo do repositório). **Hash vazio: recusa e não baixa nada.**
  Quem fixa a release confere o hash na página oficial dela; o valor não vem da própria rede na hora de instalar.
- Baixa para pasta temporária, confere o SHA-256 e só então instala em `/opt/sabre/limbo/picolimbo`.
- Grava `/var/lib/sabre/limbo/server.toml` (modo 600, dono `sabre`): escuta **só `127.0.0.1:25566`**, *modern
  forwarding* com o segredo do Velocity copiado de `forwarding.secret` direto para o arquivo (nunca impresso) e a
  mensagem "Trocando de casa… volta já".
- Acrescenta `espera = "127.0.0.1:25566"` em `[servers]` do `velocity.toml` (o `host` e o `try` não mudam).
- Instala a unidade `sabre-limbo` **desligada** (usuário `sabre`, sem privilégios, memória máx. 128 MB).

## Segurança

A porta 25566 nunca entra no `ufw` (o `instalar.sh` só abre 22, 25565 e a do WireGuard). Se o segredo do Velocity for
trocado, apague `server.toml` e rode o script de novo.

## Não feito aqui / não confirmado

Quem manda o jogador para `espera` na troca de host é o plugin do rede-2.2. **Não rodado:** contêiner com Velocity +
limbo reais (sem internet nesta sessão). **Não confirmado:** nomes das chaves do `server.toml` do PicoLimbo
(`bind`, `welcome_message`, `[forwarding] method/secret`) e se o asset da release é o executável puro; conferir ao
fixar a release e ajustar o script se divergir.
