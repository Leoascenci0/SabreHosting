# Bom-dia

_Reescrito pela Máxima no encerramento da rodada da madrugada de 31/10/2026, 04:15. Estado completo em
`docs/ops/rodadas/historico/rodada-2026-10-31b.md`._

- **O que entrou nesta noite (33 PRs, todos com vistoria APROVADA aqui e `qa` nos de risco):**
  - **Convite do grupo (M2):** ajudante da rede privada com sala de entrada (#85); convite completo no cartório — só o
    dono cria, chave provisória, `/grupo` (#84); ajudante virou serviço próprio, sem `sudo` no cartório (#97, sua
    decisão); acabamentos (#145, #143). Falta só o app-1.3 (tela do convite), que precisa da sua prova no PC.
  - **Servidor:** "vigia" que salva e para o servidor se o app for fechado à força, para nunca haver dois hosts (#114);
    processo e comandos mais firmes (#89, #99); servidor só escuta em IP de PC da rede privada (#122); downloads só
    `https` e hash do NeoForge por versão (#102, #106, #109); medição da nota mais firme (#139).
  - **Backup:** restauração recusa atalho no lugar do mundo (#86); nomes com acento (#90); backup agendado cancela de
    verdade e não deixa sobra (#105).
  - **App:** reabrir o app com a trava em seu nome oferece "Hospedar" (#101); endereço continua na tela depois de Jogar
    (#137, o que você viu no Windows); ícone da bandeja só com a cabeça do tigre (#144); testes da ponte e das capturas (#131, #126).
  - **Cartório e rede:** cliente valida tudo que o cartório responde (#123); época da trava garantida no banco (#127);
    prova de que dois PCs não usam o mesmo convite (#133); cartório e app só na rede 10.66 (#135); config do WireGuard
    no PC só aceita o que o app monta (#115).
  - **CI:** actions fixadas por hash + Dependabot (#93); push na `main` confere arquivos (#111).
  - **Correção:** o check da `main` no GitHub estava vermelho desde o começo da noite (os testes de infra só passavam
    como administrador, e a sessão roda como administrador). Consertado (#118); verde em todos os pushes desde então.
- **Tutoriais para testar:** nenhum tutorial novo; as provas no PC estão em "Esperando você", item 3.
- **Decidi por você** (todos reversíveis, cada um tem o PR para desfazer): contrato do ajudante (IP da sala escolhido por
  ele; chave provisória só sai na confirmação ou no prazo); Java aceita `java` do sistema ou caminho completo; cópia do
  backup que passa do prazo é cancelada antes de religar o salvamento; "vigia" para o servidor órfão (opção que salva
  antes de parar); tela "O servidor anterior não parou" depois de 2 min; servidor só escuta em 10.66.0.2–199; cartório só
  em 10.66.0.1/loopback; endereço fixo + aviso de "copiado" por 4 s; ícone da bandeja em azulejo escuro; marcador da
  instância do Prism fica para o lanc-1.3; intervalo de renovação da trava não mudou.
- **Esperando você:**
  1. **Quem pode tirar um PC do grupo?** (cartmel-1.1) Recomendo: só o dono, pelo app.
  2. **Dependabot #95 e #96** (actions do CI 4→7): PR de autor externo, o merge é seu.
  3. **Provas no PC Windows** (passo a passo nos PRs): fechar o app à força com o servidor no ar e ver que ele salva e para
     sozinho (#114, #101); ícone da bandeja nítido a 100% e 150% (#144).
  4. Os de antes: liberar `repo.papermc.io` (rede-2.2); versão do Minecraft/NeoForge (host-3.1 e os hashes da tabela do
     #102); criar a máquina Oracle e instalar o cartório (cart-2.2); app-1.3 (tela do convite, prova no PC); D9.
- **Custo:** filhas US$ 35,88 (31 sessões; a mais cara: vigia do servidor em Opus, US$ 5,09) + esta orquestradora
  US$ 43,22 = **~US$ 79**. A orquestração custou mais que as filhas; na próxima rodada vou delegar mais conferência a
  revisores baratos.
- **O que não foi verificado:** nada rodou numa máquina de verdade (nuvem nem Windows); o firewall da sala de entrada
  só foi provado com regras carregadas no `iptables`; o vigia dentro do instalador (`app.asar`) não foi testado; o ícone
  a 16 px fica borrado (normal no tamanho, confira no PC).
