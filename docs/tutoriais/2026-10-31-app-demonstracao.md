# Testar as telas do app no modo demonstração (Windows)

**Para quem:** o Eliel, ou quem quiser ver o app antes do instalador. **Tempo:** uns 15 minutos na primeira vez.

**O que este teste faz:** abre o app de verdade no seu PC, mas com o cartório e o servidor **de mentira**. Ele não
liga o Minecraft, não abre porta e não toca em mundo nenhum. Serve para conferir a janela, o ícone na bandeja, o tema
claro e escuro e os botões. O instalador de verdade vem no item app-3.1.

## 1. Instalar duas ferramentas (só na primeira vez)

1. **Node.js 22 (LTS):** em <https://nodejs.org>, baixe o "Windows Installer" da versão **22 LTS** e instale com as
   opções padrão. O Node é o "motor" que roda o app enquanto não há instalador.
2. **Git:** em <https://git-scm.com/download/win>, baixe e instale com as opções padrão. O Git baixa o projeto do
   GitHub.

## 2. Baixar o projeto

Abra o **PowerShell** (menu Iniciar › digite "PowerShell"). Cole um comando por vez e tecle Enter:

```powershell
cd $HOME\Documents
```

```powershell
git clone https://github.com/Leoascenci0/SabreHosting.git
```

```powershell
cd SabreHosting
```

```powershell
npm ci
```

O `npm ci` baixa as peças do app (cerca de 200 MB, inclui o Electron). Pode demorar uns minutos; avisos em amarelo são
normais.

## 3. Abrir o app

Escolha o **cenário** (a situação de mentira) e abra:

```powershell
$env:SABRE_E2E="1"; $env:SABRE_E2E_CENARIO="ninguem"; npm run start -w apps/desktop
```

Troque `ninguem` por um destes para ver as outras telas (feche o app pelo ícone da bandeja › **Sair** antes):

- `ninguem` — ninguém hospedando: aparece o botão **Hospedar**.
- `outro` — o servidor está no PC de um amigo de mentira: aparece **Jogar**.
- `eu` — você está hospedando: aparecem **Jogar** e **Parar o servidor**.
- `sem-cartorio` — sem conexão com o cartório: aparece **Tentar de novo**.

## 4. O que conferir

- [ ] A janela abre com o ícone do tigre e o nome SabreHosting.
- [ ] O ícone aparece na **bandeja** (perto do relógio; às vezes escondido na setinha `^`). Ele fica legível?
- [ ] Fechar a janela no **X** só esconde: o app continua na bandeja. Clicar no ícone abre de novo.
- [ ] Abrir o app uma segunda vez (repetir o comando) não cria outra janela: só mostra a que já existe.
- [ ] Tema escuro: Configurações do Windows › Personalização › Cores › "Escuro". A janela acompanha?
- [ ] Cenário `ninguem`: **Hospedar** mostra "Subindo o servidor…" e depois "Você está hospedando".
- [ ] Cenário `eu`: **Parar o servidor** pede confirmação antes de parar.
- [ ] **Jogar** copia um endereço de exemplo (`mundo.exemplo.net`): cole no Bloco de Notas para ver.
- [ ] Textos em português, sem termo técnico estranho.

**Diferença do modo demonstração:** a pergunta "Parar o servidor e sair?" do menu **Sair** é respondida sozinha com
"sim" (assim os testes automáticos funcionam). No app de verdade ela aparece para você.

## 5. Me contar

Mande no chat uma foto da tela (tecla Windows + Shift + S) do que achou estranho, e diga qual item da lista falhou.

## Para atualizar depois

Na pasta `SabreHosting`, no PowerShell:

```powershell
git pull
```

```powershell
npm ci
```
