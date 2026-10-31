# Tutorial — ligar o Google Drive para guardar um histórico longo de backups

Este passo a passo mostra como deixar uma cópia extra dos backups do mundo numa pasta do **Google Drive** no seu PC.
Você instala o programa do Google, escolhe uma pasta que ele sincroniza e aponta o SabreHosting para essa pasta.
Tempo: de 15 a 30 minutos, quase tudo esperando o download e a sincronização.

Você não precisa saber programar. Termos em inglês estão explicados na primeira vez.

> **Regra de ouro:** o app nunca copia a pasta do mundo que está rodando. Ele só copia o **backup já fechado** (um
> arquivo só, conferido por hash, que é uma espécie de "impressão digital" do arquivo: se uma letra mudar, o hash
> muda). O mundo do seu PC e o backup local continuam onde estão.

**Termos usados aqui**
- **Google Drive para Computador** (*Google Drive for desktop*): o programa do Google que deixa uma pasta do seu PC
  igual à sua conta do Drive na internet. O que você põe nela sobe para a nuvem do Google, e o que sobe lá aparece nela.
- **Sincronizar**: manter duas cópias iguais, uma no PC e outra na nuvem.
- **Backup**: uma foto do mundo guardada em um arquivo, para voltar atrás se algo der errado.
- **Histórico longo**: backups guardados por mais tempo do que os do próprio PC, numa pasta do Drive.
- **Hash**: a "impressão digital" de um arquivo, usada para conferir que a cópia é idêntica ao original.

---

## Antes de começar

- Você precisa de uma **conta do Google** com espaço livre no Drive. Cada backup ocupa quase o tamanho do mundo
  compactado; confira o espaço em drive.google.com antes de começar.
- Não precisa parar o servidor do SabreHosting para isso: ligar a pasta não mexe no servidor.
- Não use a pasta de **backups do SabreHosting** nem a pasta do **mundo** como pasta do Drive. O app recusa as duas
  (e diz isso na tela), mas é bom você já saber.

## Passo 1 — Instalar o Google Drive para Computador

1. No navegador, abra o site oficial do Google para o programa: **google.com/drive/download**.
2. Clique em baixar, abra o instalador e siga as telas.
3. Entre com a sua conta do Google.
4. Espere o programa terminar a primeira sincronização. Ele mostra um ícone de nuvem na barra de tarefas do Windows
   (perto do relógio).

Por quê: o app do SabreHosting não fala com o Google diretamente. Ele só escreve numa pasta comum do PC, e é o
programa do Google que pega essa pasta e manda para a nuvem. Por isso o histórico longo não depende de senha do Google
dentro do SabreHosting.

## Passo 2 — Criar uma pasta só para os backups

1. Abra o **Explorador de Arquivos** (o ícone de pasta amarela na barra de tarefas).
2. Vá até a unidade do Google Drive. Ela aparece com uma letra (por exemplo **G:**) ou com o nome **Google Drive**,
   dependendo da versão do programa.
3. Dentro dela, crie uma pasta nova (botão **Novo** › **Pasta**, ou clique com o botão direito › **Nova pasta**).
   Dê um nome fácil, como **SabreHosting historico**.

Por quê: uma pasta só para isso evita misturar os backups com outros arquivos e deixa fácil apagar tudo, se um dia
quiser parar.

**Importante:** deixe a pasta do Drive **inteira no PC**, não só "na nuvem". Se o programa tiver a opção
**Disponível off-line** (ou **Espelhar arquivos**) para a pasta, escolha essa. Sem isso, o backup pode ser copiado para
o Drive e ficar só como um atalho, sem ocupar espaço no PC.

| Se der errado | O que fazer |
|---|---|
| Não aparece nenhuma unidade do Google Drive no Explorador | Abra o programa do Google pela barra de tarefas e confira se a conta entrou. Se não aparecer, reinicie o PC. |
| A pasta criada "some" depois de um tempo | Ela foi apagada ou movida no site do Drive. Crie outra e use a nova no passo 3. |

## Passo 3 — Apontar o SabreHosting para a pasta

1. Abra o SabreHosting e clique em **Configurações**.
2. Vá até a parte **Backups**.
3. Marque a caixinha **Copiar também os backups para uma pasta (Drive, OneDrive…)**.
4. Clique em **Escolher pasta…** e escolha a pasta que você criou no passo 2 (dentro do Drive).
5. Em **Quantos guardar nesta pasta**, deixe o padrão **10**. A pasta guarda os 10 backups mais novos, e os de
   **últimos 7 dias** sempre ficam, além desses.
6. Clique em **Salvar**.

Por quê: a partir daí, cada backup novo que o app faz é copiado para essa pasta depois que a cópia no seu PC fica
pronta e conferida. O backup do PC é feito antes e continua salvo mesmo se a cópia falhar.

**O que acontece com os backups antigos:** o app apaga sozinho os mais antigos **da pasta** quando passa do limite.
Como a pasta está no Drive, **apagar na pasta também apaga na nuvem**. Isso é o combinado: o histórico longo tem um
limite, não cresce sem fim.

| Se der errado | O que quer dizer e o que fazer |
|---|---|
| "A pasta do histórico não foi encontrada; o backup deste PC está salvo." | A pasta sumiu ou o Drive não está aberto. O backup do PC está salvo. Abra o programa do Google e confira a pasta. |
| "Escolha uma pasta completa…" | A pasta tem que ser de dentro do seu PC (com a letra da unidade ou o caminho todo). Escolha de novo pelo botão **Escolher pasta…**. |
| "a pasta não pode ser a dos backups nem a do mundo deste PC…" | Você escolheu a pasta errada. Crie outra pasta dentro do Drive, como no passo 2. |
| "já existe … na pasta; não escrevi por cima." | Um backup com esse nome já está lá. Nada foi apagado. Confira a pasta; o próximo backup usa outro nome. |
| "já há uma cópia incompleta (….parcial) na pasta" | O Drive ainda está enviando um arquivo. Espere o ícone do Drive parar de girar; o próximo backup tenta de novo. |
| "a cópia não bateu com o original (hash). Descartei a cópia." | A cópia veio com erro (em geral, pasta sincronizando ou disco cheio). Nada ficou pela metade; o backup do PC segue salvo. |

## Passo 4 — Conferir se os backups chegaram

1. Espere o próximo backup do app (ou faça um agora pela tela de **Backups**).
2. Abra a pasta do Drive no Explorador de Arquivos. Deve aparecer um arquivo novo, com um nome parecido com
   **2026-10-31T14-05-09-123Z-v12.tar.gz**: a data, a hora e o número da versão do mundo.
3. Confira no site **drive.google.com**, dentro da mesma pasta, se o arquivo aparece lá também. Pode levar alguns
   minutos.

Se o arquivo aparecer no PC mas não no site, espere a sincronização terminar (o ícone do Drive para de girar). Se
continuar sem aparecer, veja a linha de **sincronização** na tabela do passo 2.

---

## O que ainda não acontece sozinho

- O histórico longo é só uma **cópia extra**. Ele não substitui o backup do PC e não é usado para jogar: para voltar
  um mundo, o app ainda usa os backups do próprio PC.
- Se você trocar a pasta do Drive para outra, os backups da pasta antiga **não são movidos** para a nova. Eles
  continuam onde estão.
- Você pode desligar a caixinha a qualquer momento: o app para de copiar, e a pasta do Drive fica como está.

## Depois de ligar

- Deixe o programa do Google aberto de vez em quando, para ele sincronizar.
- Se o espaço do Drive acabar, a cópia para a pasta vai falhar e a tela de **Backups** mostra o aviso. Aumente o
  espaço no site do Drive ou diminua **Quantos guardar nesta pasta** no SabreHosting.
- Não mexa nos arquivos dentro da pasta (renomear, editar, apagar à mão). O app lê os nomes para saber o que já
  tem.

## Dúvidas

- Se nada aparecer na pasta depois de dois backups, peça ajuda ao dono do grupo e diga qual mensagem aparece na
  tela de **Backups**.
