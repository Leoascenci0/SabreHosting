# Bom-dia

_Reescrito pela Máxima no fim de cada onda, ao pausar e no encerramento. Atualizado em 31/10/2026, 02:00 (madrugada; rodada
do convite ainda andando — estado completo em `docs/ops/rodadas/rodada-2026-10-31b.md`)._

- **O que entrou nesta noite (17 PRs mergeados até agora):**
  - Convite do grupo: ajudante da rede privada e sala de entrada (#85); convite completo no cartório — só o dono cria,
    chave provisória, `/grupo` (#84); ajudante virou serviço próprio, sem `sudo` no cartório (#97, sua decisão).
  - Servidor: processo mais firme (#89), comandos mais rígidos e cópia do backup com prazo (#99), hashes do NeoForge
    por versão (#102), downloads só `https` (#106), testes de redirecionamento (#109).
  - Backup: restauração recusa atalho no lugar do mundo (#86), nomes com acento/maiúscula (#90), sobras do backup
    agendado e cancelamento de verdade (#105).
  - App: reabrir o app com a trava em seu nome oferece "Hospedar" de novo (#101).
  - Rede: config do WireGuard no PC só aceita o que o app monta (#115). CI: actions fixadas por hash (#93), push na
    `main` confere arquivos (#111). Launcher: nome da instância não quebra emoji (#117).
  - **Correção:** o check da `main` no GitHub estava vermelho desde o começo da noite (testes de infra só passavam como
    administrador); consertado (#118) e anotado como S-03 para não voltar.
- **Tutoriais para testar:** nenhum novo (nada de tela nova para você ver; os itens com prova no PC estão abaixo).
- **Decidi por você** (reversíveis; cada um tem o PR para desfazer): contrato do ajudante (IP da sala escolhido por ele;
  chave provisória só sai na confirmação); Java aceita `java` do sistema ou caminho completo; cópia do backup que passa do
  prazo é cancelada antes de religar o salvamento; servidor órfão (app fechado à força) é encerrado por um "vigia" que
  salva e para (hostmel-2.5, em revisão); servidor só escuta em IP de PC da rede privada (10.66.0.2–199); marcador da
  instância do Prism fica para o lanc-1.3; intervalo de renovação da trava não mudou.
- **Esperando você:**
  1. **cartmel-1.1 — quem pode tirar um PC do grupo?** Recomendo: só o dono, pelo app (o PC tirado perde o acesso ao
     cartório; tirar da rede privada vira item de rede à parte).
  2. **Dependabot #95 e #96:** atualizações grandes das actions do CI (checkout 4→7, setup-node 4→7). PR de autor externo:
     o merge é seu (recomendo esperar eu rodar a vistoria deles de dia).
  3. **Provas no PC Windows:** appmel-1.5 (fechar o app à força e reabrir) e hostmel-2.5 (o servidor salva e para
     sozinho); passo a passo em cada PR.
  4. Os de antes: liberar `repo.papermc.io` (rede-2.2); versão do Minecraft/NeoForge (host-3.1 e os hashes do hostmel-1.1);
     criar a máquina Oracle e instalar o cartório (cart-2.2); app-1.3 (prova no PC); D9.
- **Custo:** não registrado ainda (fecho no encerramento).
- **O que não foi verificado:** nada rodou numa máquina de verdade (nuvem nem Windows); o firewall da sala de entrada
  só foi provado com regras carregadas no `iptables`; o vigia dentro do instalador (`app.asar`) não foi testado.
