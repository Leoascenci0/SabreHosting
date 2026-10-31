# Tutorial — trazer o mundo da hospedagem paga para o SabreHosting

Este passo a passo leva o mundo que hoje está na hospedagem paga (o servidor alugado) para o SabreHosting. Você
**baixa** o mundo do painel da hospedagem como um arquivo `.zip` e **importa** esse arquivo no app. Tempo: de 10 a 40
minutos, quase tudo esperando o download e o envio.

Você não precisa saber programar. Termos em inglês estão explicados na primeira vez.

> **Regra de ouro:** o mundo dos amigos é o que temos de mais valioso. Nada aqui apaga mundo nenhum: a hospedagem
> continua com o mundo dela, o seu PC continua com o dele, e o app só **acrescenta** uma versão nova ao grupo.

**Termos usados aqui**
- **Painel da hospedagem**: o site onde você administra o servidor pago (cada empresa tem o seu).
- **`.zip`**: um arquivo "compactado", que guarda uma pasta inteira dentro dele.
- **Versão do mundo**: cada vez que o mundo do grupo é guardado, ele ganha um número (1, 2, 3…). O app sempre joga
  na versão mais nova.
- **Plugins** e **mods**: programas extras que alguns servidores usam (proteções de terreno, lojas, blocos novos).

---

## Passo 1 — Parar o servidor da hospedagem

No painel da hospedagem, clique em **Parar** (*Stop*) e espere aparecer "parado" (*offline*).

Por quê: com o servidor ligado o mundo está sendo gravado o tempo todo, e uma cópia feita nessa hora pode sair
quebrada. Avise os amigos antes para ninguém estar jogando.

## Passo 2 — Baixar o mundo como `.zip`

Cada painel tem um nome diferente para isso; procure por um destes caminhos:

- **Gerenciador de arquivos** (*File Manager* ou *Files*): marque a pasta do mundo (quase sempre se chama `world`),
  clique em **Compactar** (*Compress* / *Archive*) e depois em **Baixar** (*Download*) no `.zip` que aparecer.
- **Backups**: muitos painéis têm um botão **Criar backup** e depois **Baixar**; o arquivo baixado já é um `.zip`.
- **Mundos** (*Worlds*): alguns painéis têm um botão direto **Baixar mundo** (*Download world*).

Guarde o arquivo numa pasta fácil, como **Downloads**. Não precisa abrir nem mexer dentro dele.

| Se der errado | O que fazer |
|---|---|
| O painel só deixa baixar arquivo por arquivo | Procure **Compactar** primeiro; se não houver, peça o backup ao suporte da hospedagem. |
| Tem mais de uma pasta de mundo (`world`, `world_nether`, `world_the_end`) | Servidores com plugins guardam o Nether e o End em pastas separadas, e a importação ainda leva só a `world`. **Pare aqui** e fale com o dono do grupo: importar só a `world` deixaria o Nether e o End para trás. |
| O arquivo baixado termina em `.tar.gz` ou `.rar` | Ainda não aceitamos esses formatos: peça ao painel um `.zip`. |

## Passo 3 — Importar no app

Faça isto no **PC do dono do grupo** quando o grupo já tiver um mundo; para o **primeiro** mundo do grupo, qualquer
PC do grupo pode importar.

1. Abra o SabreHosting. Se o servidor estiver ligado neste PC, clique em **Parar** antes.
2. Clique em **Backups** e depois em **Importar mundo**.
3. Escolha o `.zip` que você baixou. O app confere o arquivo inteiro **sem gravar nada** e mostra:
   - a versão do Minecraft do mundo (ex.: "Minecraft 1.21.1");
   - avisos, se o mundo veio de um servidor com **plugins** ou com **mods**.
4. Leia a mensagem antes de confirmar:
   - **Grupo ainda sem mundo:** "Ele vira o mundo do grupo e fica guardado na nuvem". Clique em **Importar**.
   - **Grupo que já tem mundo** (só aparece para o dono): "Isto vira a versão mais nova do grupo; o mundo atual
     continua guardado nos backups". Clique em **Importar e virar a versão mais nova** só se é isso mesmo que o grupo
     quer.
5. Espere a mensagem **"Pronto: o mundo importado virou a versão N do grupo"**. Deixe o app aberto até lá.

| Se der errado | O que quer dizer e o que fazer |
|---|---|
| "Zip do mundo recusado: …" | O arquivo tem algo estranho (nome perigoso, tamanho falso, arquivo repetido). Nada foi alterado. Baixe o mundo de novo pelo painel. |
| "Esse arquivo não parece ser um .zip válido" | O download veio incompleto. Baixe de novo. |
| "Outro PC está mexendo no mundo do grupo agora" | Alguém está hospedando. Espere o servidor parar e tente de novo. |
| "Este PC está hospedando agora" | Clique em **Parar** na tela inicial e tente de novo. |
| "Só o dono do grupo pode importar…" | O grupo já tem mundo: peça para o dono do grupo fazer a importação. |
| "Não deu para ler a versão do Minecraft" (aviso) | Dá para importar, mas confira no painel da hospedagem qual versão o servidor usava. |

## O que ainda não acontece sozinho

- O mundo importado fica guardado no **cartório da nuvem** como a versão mais nova do grupo. Levar essa versão da
  nuvem para o PC que vai hospedar ainda é um passo de uma próxima versão do app; até lá, combine com o dono do
  grupo antes da primeira partida no mundo importado.
- Plugins e mods **não** são importados: só o mundo.

## Depois de importar

Não cancele a hospedagem paga ainda. O plano é jogar algumas semanas no SabreHosting e só então decidir (item
`piloto-1.3`).
