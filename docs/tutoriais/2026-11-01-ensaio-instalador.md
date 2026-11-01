# Tutorial — instalar o SabreHosting de teste no seu PC (Windows)

Primeira prova do **instalador** de verdade, o arquivo `.exe` que um amigo vai baixar. É uma versão de **ensaio**:
ninguém mais recebe, ela some do GitHub em **08/11/2026** e não mexe em nada do Minecraft que você já tenha.
Tempo: uns 15 minutos.

**Termos usados aqui**
- **Instalador** (`.exe`): o programa que copia o SabreHosting para o seu PC e cria o atalho.
- **Artefato** (*artifact*): um arquivo que o GitHub guarda depois de montar algo. O nosso vem dentro de um `.zip`.
- **SmartScreen**: o aviso azul do Windows para programa que ainda não tem assinatura paga (decisão D9, ainda em
  aberto com você). É esperado nesta fase.

---

## 1. Baixar

1. Entre no GitHub com a sua conta e abra:
   https://github.com/Leoascenci0/SabreHosting/actions/runs/41342283125
2. No fim da página, em **Artifacts**, clique em **instalador-ensaio** (cerca de 117 MB). Baixa um `.zip`.
3. Clique com o botão direito no `.zip` › **Extrair tudo**. Dentro está `SabreHosting-Setup-0.0.0.exe`.

## 2. Instalar

1. Dê dois cliques no `.exe`.
2. Se aparecer o aviso azul "O Windows protegeu o computador": **Mais informações** › **Executar assim mesmo**.
   Anote se apareceu (é a prova do D9).
3. Siga as telas. Ele pergunta onde instalar; pode deixar o padrão.
4. No fim, deixe marcado "Executar SabreHosting" e clique em **Concluir**.

## 3. O que conferir (anote o que der diferente)

1. O app abre sozinho e mostra a tela de **boas-vindas**, pedindo o convite do grupo.
2. Aparece o ícone do SabreHosting perto do relógio (bandeja do Windows).
3. Fechar a janela no **X** deixa o ícone na bandeja; **Sair** pelo menu do ícone fecha de vez.
4. Abrir de novo pelo atalho do menu Iniciar funciona.
5. **Painel de Controle › Programas** mostra o SabreHosting, e **Desinstalar** remove sem erro.

**O que ainda NÃO dá para testar:** entrar no grupo com um convite e o botão "Tentar de novo". Os dois precisam do
cartório (o serviço do grupo na máquina da nuvem), que ainda não foi instalado lá (item cart-2.2, espera você).
Até lá, a tela de boas-vindas fica parada no convite, e isso é o esperado.

## 4. Me contar

No chat da Máxima, diga para cada passo do 3: ✅ ou o que apareceu (um print ajuda). Diga também se o aviso azul
apareceu e quanto tempo levou para instalar.
