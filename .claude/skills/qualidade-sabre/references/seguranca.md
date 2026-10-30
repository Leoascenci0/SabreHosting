# Segurança

Projeto pessoal, mas roda no PC dos amigos e numa máquina na internet. O que mais importa: ninguém de fora entra no
PC de um amigo, ninguém de fora derruba ou troca o mundo, e nenhum segredo vaza pelo GitHub.

## 1. Rede

- PCs dos amigos **nunca** abrem porta no roteador nem usam UPnP. Toda conexão entre PCs e com a nuvem passa pela
  rede privada (WireGuard, decisão D2) iniciada de dentro para fora.
- Na máquina da nuvem, abertas para a internet só: a porta do Minecraft (proxy Velocity) e a do WireGuard. Cartório
  e transferências escutam **só** na rede privada.
- Velocity com *modern forwarding* e segredo; servidores dos hosts aceitam conexão só do IP privado do proxy.
- Lista de permissão (whitelist) do Minecraft ligada; só os amigos cadastrados entram.

## 2. Cartório e convites

- Cada PC tem um token próprio, emitido por convite (código de uso único com validade curta) e guardado no cofre do
  sistema (`safeStorage`). Token revogável pelo Eliel.
- Toda chamada ao cartório autenticada; comandos que mudam estado (trava, versão) conferem token **e** época.
- O cartório nunca manda o app executar algo: só responde dados. O app nunca roda comando vindo da rede.

## 3. Downloads e execução

- Jar do servidor (Paper/Fabric), Java (Adoptium) e plugins: só de fonte oficial, versão fixada, SHA-256 conferido.
- Pacote de mundo recebido: conferir hash; nomes de arquivo sem `..` nem caminho absoluto (*zip slip*).
- Atualização do próprio app: assinada; não instalar pacote sem assinatura válida.

## 4. Segredos

- Nada de segredo no repositório: `scripts/verificar.py` barra padrões comuns (chave privada, token, `.env`).
- Segredos da máquina da nuvem ficam nela (arquivo com permissão 600) e num cofre do Eliel; o script de instalação
  gera, não recebe pelo chat.

## 5. Nunca

- Abrir porta no PC de um amigo; desligar a whitelist; executar comando recebido pela rede; guardar segredo no git;
  baixar sem hash; aceitar escrita do cartório sem época.
