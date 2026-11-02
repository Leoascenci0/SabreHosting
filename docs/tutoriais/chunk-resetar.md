# Tutorial — resetar um pedaço do mundo (só em mundo de TESTE)

Este passo a passo mostra a aba **Mundo**: apagar uma área do mapa (por exemplo, o Nether para ele nascer de novo),
com backup antes e botão de desfazer. Tempo: uns 20 minutos.

> **Regra de ouro:** teste **só com um mundo de teste criado de propósito**, nunca com o mundo real dos amigos.
> Reset apaga pedaços do mundo de verdade. O backup protege, mas não vale arriscar.

**Termos usados aqui**
- **Chunk**: um pedaço do mundo de 16 x 16 blocos (de cima a baixo, todo o terreno daquela fatia).
- **Região**: um arquivo do disco que junta 32 x 32 chunks = 512 x 512 blocos.
- **Dimensão**: Mundo normal, Nether ou End. Cada uma tem as próprias regiões.
- **Backup “Antes de resetar”**: a cópia do mundo que o app faz sozinho um instante antes de apagar.

---

## 1. Criar o mundo de teste

1. Instale o app de teste (tutorial do ensaio do instalador) e entre como **dono** do grupo. Quem não é dono só vê o
   aviso "Só o dono do grupo pode resetar".
2. Crie um grupo **novo, só para teste**, ou importe um `.zip` de um mundo qualquer feito para isso (um mundo novo do
   Minecraft, jogado uns 10 minutos andando em várias direções, serve).
3. Clique em **Hospedar**, entre no jogo, ande para longe do ponto inicial, construa uma casinha de terra e saia.
4. **Pare o servidor** no app (a aba Mundo só deixa resetar com o servidor parado).

## 2. Abrir a aba Mundo e escolher a área

1. Na barra, clique em **Mundo**.
2. Em **1. Onde apagar**, escolha a **Dimensão** (comece pelo Mundo normal).
3. Escolha como marcar a área:
   - **Retângulo**: digite dois cantos em blocos (os números aparecem no jogo ao apertar **F3**, campo XYZ); ou
   - **Ao redor de um ponto**: digite X, Z e o raio em blocos; ou
   - **Clicar nas regiões**: os quadrados abaixo são as regiões que existem no disco. Clicar marca.
4. Cuidado com a grade: se você marcar quadrados **afastados**, o app apaga o **retângulo que cobre todos**. Os do
   meio ganham contorno tracejado e o aviso diz quantos são. Se não quer apagar o meio, marque uma região por vez.

## 3. Ver a prévia

1. Em **2. Ver o que será apagado**, clique em **Ver prévia**.
2. Leia: "Vai apagar N chunks", quanto espaço libera (com o tamanho do mundo todo para comparar), "Atinge N regiões"
   e "Um backup é feito antes".
3. Se a área for muito grande (mais de 1.024 chunks ou raio de 1.000 blocos), o app pergunta antes. **Esc** ou
   **Escolher outra área** volta atrás.
4. Se disser "Não existe nenhum chunk nessa área", nada será apagado; escolha outra.

## 4. Resetar (com confirmação)

1. Em **3. Resetar**, clique em **Resetar…**
2. O app repete o que vai acontecer, com o nome do mundo e a hora do backup. **Digite o nome do mundo** no campo
   (as maiúsculas contam). Se o botão estiver apagado, o texto logo abaixo do campo diz o que falta.
3. Clique em **Resetar a área** (ou **Enter**). Aparece a barra de progresso; **não feche o app**.
4. Ao fim: "Pronto neste PC: N chunks apagados" e se a versão já foi enviada ao grupo.

## 5. Conferir

1. Abra **Backups**: deve haver um backup chamado **Antes de resetar**, com a data de agora.
2. Volte em **Mundo**: a região apagada sumiu da grade.
3. Hospede e entre no jogo: aquela área nasce de novo, e o resto do mapa (a casinha fora da área) está igual.

## 6. Desfazer

1. Em **Desfazer**, a linha mostra "Último reset: backup “Antes de resetar” de <data>". Clique em **Desfazer o
   último reset** e confirme digitando o nome do mundo.
2. Se vocês **jogaram depois do reset**, o app avisa: desfazer faz sumir o que foi jogado desde então. Isso fica
   guardado no backup **Antes de restaurar** e há uma 2ª confirmação, que mostra a data do backup para onde volta.
3. Confira no jogo que o mundo voltou ao que era antes do reset.

## 7. Se aparecer um aviso

| Aviso | O que significa | O que fazer |
|---|---|---|
| "Pare o servidor para resetar" | O servidor está ligado. | Pare o servidor no app. |
| "Conclua o reset anterior…" / reset ainda não enviado | O reset valeu neste PC, mas o grupo ainda não recebeu. | Deixe o app aberto com internet e clique em **Hospedar**; ele envia antes de ligar. |
| Conflito: "o mundo daqui e o do grupo divergiram" | O grupo recebeu mudanças que este PC não tem. Nada foi apagado; o backup “Antes de resetar” continua lá. | Se quiser seguir o grupo, **Descartar este aviso…** (só com o servidor parado) e confirme. |
| Não deixou digitar o nome / "não consegui ler o nome" | O app não achou o nome do mundo. | Feche e abra a aba Mundo; se repetir, me conte. |

## 8. Me contar

Anote: o que não ficou claro, qualquer palavra difícil na tela, se a prévia bateu com o que sumiu e se o desfazer
devolveu tudo. Mande a captura de tela do que estranhou.

**Ainda não conferido num PC Windows com servidor Minecraft de verdade:** é exatamente o que este teste prova.
