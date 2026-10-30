# Proxy Velocity — instalação e limites

`sudo bash infra/vps/instalar-velocity.sh` (depois do `instalar.sh`). Pode rodar de novo: não regenera o segredo, a
configuração nem o jar. `SABRE_SIMULAR=1` só mostra o que faria. Para outro destino inicial:
`SABRE_DESTINO=10.66.0.5:25565` (só vale `10.66.0.2` a `10.66.0.254`).

## O que faz

- Baixa o jar do Velocity pela API oficial do PaperMC (versão fixada no script), lê o SHA-256 que a API informa,
  baixa para uma pasta temporária e **só instala se o hash bater**. Hash errado: apaga e para.
- Gera o segredo do *modern forwarding* (48 bytes aleatórios) em `/var/lib/sabre/velocity/forwarding.secret`, dono
  `sabre`, permissão 600. O valor nunca é impresso nem entra no `velocity.toml`; ele precisa ser copiado para o
  servidor do host por canal seguro (item de mods/host), nunca por chat nem git.
- Grava `velocity.toml` (só se ainda não existe) e uma `whitelist.txt` vazia.
- Instala a unidade `sabre-velocity` **desligada**.

## Campos de segurança do `velocity.toml`

| Campo | Valor | Por quê |
|---|---|---|
| `bind` | `0.0.0.0:25565` | única porta pública do proxy |
| `online-mode` | `true` | o proxy confere a conta Microsoft |
| `force-key-authentication` | `true` | exige chave de chat assinada pela Mojang |
| `player-info-forwarding-mode` | `modern` | repassa UUID e conta com assinatura (HMAC) do segredo |
| `forwarding-secret-file` | `forwarding.secret` | segredo fora do toml |
| `[servers] host` | `10.66.0.x:25565` | destino na rede privada; provisório até o rede-2.2 |

## Whitelist: o Velocity NÃO tem nativa

O Velocity não traz lista de permissão própria; ela exige plugin. Este item deixa o ponto pronto
(`whitelist.txt`, um nome ou UUID por linha, a ser preenchido pelo cartório) mas **não instala plugin**. Por isso a
unidade fica desligada. Itens seguintes: (1) plugin de whitelist (de terceiros, com versão e hash fixados, ou o
plugin próprio do rede-2.2); (2) ligar também a whitelist no servidor do host (`white-list=true`): com modern
forwarding o servidor recebe o UUID real, então a lista dele vale como segunda barreira.

## Servidor NeoForge do host (modern forwarding)

O NeoForge não entende o modern forwarding sozinho: precisa de um mod de compatibilidade. Candidato a confirmar
(não verificado aqui, sem internet): **Proxy Compatible Forge** (PCF), que implementa o forwarding do Velocity em
Forge/NeoForge; a fonte é a página do mod no Modrinth. A instalação dele no host fica para o item de mods. No host
valem `online-mode=false` e a porta aberta **só** para o IP do proxy na rede privada.
**Sem o mod, o host recusa a conexão** (fica seguro, só não entra ninguém).

## Não feito aqui

Troca do host da vez (rede-2.2), sala de espera (rede-2.3), plugin de whitelist, mod no host, abrir porta na Oracle.
**Não rodado:** contêiner com Velocity real + servidor falso (sem internet e sem o jar nesta sessão).
