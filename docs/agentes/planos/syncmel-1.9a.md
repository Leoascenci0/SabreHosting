# Plano syncmel-1.9a — Ligar o espalhar ao app (núcleo + main, sem tela)

Base 0762634. Método M1 (+M2 +M7). Corte: sem a tela "Limite de banda" (1.9b). A nuvem NÃO é fonte.

1. `fontesDeCopias(copias, euId)` (núcleo/sync/espalhar.ts): fontes = PCs de `quemTem` com `ip` não nulo, sem este PC, porta
   `PORTA_ESPALHAR`. `ip === null` é descartado (não derruba a lista). Teste: ip null, o próprio PC e lista só de nulos.
2. `criarEspalhador` recebe `servidorOrfao`; órfão vivo ou erro ao checar = recusa (lado seguro), antes de pegar a vez.
3. Gatilho em segundo plano (`criarGatilhoEspalhar`): maisNova → quemTem → espalhador; sem await na tela, erro vira aviso,
   uma só rodada por vez. Principal chama no arranque, a cada 10 min (um só relógio) e após backup bom.
4. Janela entre os dois renames: a checagem do 2º rename usa só o relógio local (`temAtualizacaoLocal` = `Renovador.temTrava`
   e `servidorParado`), sem rede (antes: até ~20 s de cartório). Renovador ganha o nome da trava nas mensagens
   ("trava de atualização" no espalhar; texto de host inalterado).
5. Teste de integração de `/atualizacao` com o cartório de verdade + 3 PCs simulados chegando à versão M sem tocar o
   mundo do host.

Fora: nova trava, novo manifesto, nuvem como fonte, tela de banda, servir arquivos no app (achado a registrar).
