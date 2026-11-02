# Roadmap chunk — Resetar pedaços do mundo pelo app

Pedido do Eliel (02/11/2026), depois de ver um painel de servidor que tem esse recurso: **resetar chunks pelo app**.
Sigla `chunk`. Ramos `roadmap/chunk-<id>`. Nasce depois do bloco 2 do `appuimel` (a aba **Mundo** usa a casca nova),
mas os itens 1.1 a 1.4 (núcleo) não dependem de tela e podem ir antes.

## O que é, em português
O mundo do Minecraft é dividido em **chunks** (pedaços de 16 x 16 blocos, de cima a baixo) e os chunks ficam agrupados em
**regiões** (arquivos `.mca`, 32 x 32 chunks cada). **Resetar** um chunk é apagá-lo do arquivo: na próxima vez que alguém
chegar lá, o Minecraft gera o terreno de novo (útil para pegar estruturas e biomas de uma versão nova, ou desfazer uma
área destruída). Construções, baús e animais daquela área **somem junto**: por isso o app avisa, mostra a prévia e faz
backup antes.

## Regras que valem para todos os itens (vêm do CLAUDE.md)
- **Regra de ouro 1 e 2:** só com o servidor **parado** e com a trava de host deste PC; nunca mexer na pasta do mundo com o
  servidor rodando. Sem trava, o app recusa.
- **Regra de ouro 3:** trabalhar em cópia temporária, conferir hash, só então renomear; falha no meio = mundo igual ao de
  antes. Nunca escrever por cima em pedaços.
- **Regra de ouro 4:** **backup antes**, sempre, com `origem: antes-de-resetar` (nova origem; reaproveita o campo do
  `appuimel-1.1`); nunca apagar o último backup bom; "Desfazer" = restaurar esse backup.
- **Regra de ouro 5:** o reset gera **versão nova** do mundo; só hospeda quem tem a mais nova (o espalhar leva aos outros PCs).
- **Regra de ouro 6:** testes só com mundo inventado (`tests/mundos/`); nunca o mundo real dos amigos.
- **Só toca o que o amigo escolheu:** a dimensão e a área pedidas, nas pastas `region`, `entities` e `poi` (as três têm
  que andar juntas, senão sobram animais e pontos de interesse de um terreno que não existe mais). Nunca `level.dat`,
  `playerdata`, outras dimensões nem outras regiões.
- **Desempenho:** ler só o **cabeçalho** (8 KiB) de cada `.mca` para saber quais chunks existem; nunca o mundo inteiro na RAM.
- **Entrada não confiável:** coordenadas, dimensão e nomes de arquivo são validados; nada de caminho montado a partir de texto cru.
- **Quem pode resetar:** decisão de regra do grupo, **fica com o Eliel**. Padrão proposto até ele decidir: só o dono do
  grupo, e só no PC que está com a trava. (Item 1.5 confirma antes de ligar a ação.)

## Itens (ordem de execução)

- [ ] **1.1 — Núcleo: ler o que existe no mundo (só leitura)**
  *O que fazer:* função que, dada a pasta do mundo e a dimensão (`overworld`, `nether`, `end`), lista as regiões e, pelo
  cabeçalho de cada `.mca`, quais chunks existem (e o tamanho em disco), incluindo `entities/` e `poi/` quando houver.
  Só lê; não escreve; ignora link simbólico e arquivo fora do padrão `r.<x>.<z>.mca`.
  *Arquivo:* `packages/nucleo/src/mundo/regioes.ts` (+ `index.ts`), testes com mundo inventado
  **Tela no app:** não se aplica.
  *Confirmação:* testes (mundo de teste com regiões parciais; arquivo torto é ignorado, não quebra; nada lido além do cabeçalho).
  *Depende de:* nada

- [ ] **1.2 — Núcleo: planejar o reset (prévia, sem apagar nada)**
  *O que fazer:* a partir de dimensão + área (retângulo em coordenadas de chunk, ou ponto + raio em blocos), devolver o
  **plano**: quantos chunks existem na área, quantas regiões são tocadas, quanto espaço libera, quais arquivos mudam,
  e avisos ("a área inclui o ponto de nascimento", "há regiões inteiras"). Valida limites e rejeita área gigante sem
  confirmação. Puro cálculo: não escreve.
  *Arquivo:* `packages/nucleo/src/mundo/planejar-reset.ts`, testes
  **Tela no app:** não se aplica (alimenta a prévia do 1.6).
  *Confirmação:* testes (área vazia, parcial, região inteira, coordenada negativa, valor torto recusado).
  *Depende de:* 1.1

- [ ] **1.3 — Núcleo: executar o reset com troca atômica**
  *O que fazer:* aplicar o plano: para cada região tocada, copiar o `.mca` para pasta temporária, **zerar no cabeçalho** as
  entradas dos chunks escolhidos (posição e data) em `region`, `entities` e `poi`, conferir o hash do que sobrou, e só
  então trocar por rename; região que fica vazia é apagada. Pré-condições recusadas com texto claro: servidor parado
  exigido, trava deste PC exigida, nenhum backup/restauração em andamento. Faz o backup `antes-de-resetar` pelo mesmo
  `fazerBackup` **antes** de qualquer escrita; se o backup falhar, não reseta. Falha no meio = mundo como estava.
  *Arquivo:* `packages/nucleo/src/mundo/resetar.ts`, `backup/manifesto.ts` (valor novo `antes-de-resetar`), testes
  **Tela no app:** não se aplica.
  *Confirmação:* testes que falham antes e passam depois: reset de 1 chunk, de uma região inteira, falha injetada no meio
  (mundo intacto), servidor rodando recusado, sem backup não reseta; `level.dat` e `playerdata` com o mesmo hash depois.
  *Depende de:* 1.2 e do `appuimel-1.1` (já no ar)

- [ ] **1.4 — Nova versão do mundo e "Desfazer"**
  *O que fazer:* depois do reset, subir a versão do mundo no cartório (como o fim de uma hospedagem) para os outros PCs
  atualizarem; "Desfazer o último reset" restaura o backup `antes-de-resetar` pelo restaurar de hoje (que já faz backup do
  estado atual antes). Só o último reset é desfeito de um clique; os mais antigos pela lista de Backups.
  *Arquivo:* `packages/nucleo/src/mundo/`, `apps/desktop/src/main/` (ligação com versão e restaurar), testes
  **Tela no app:** não se aplica (alimenta o 1.6).
  *Confirmação:* testes (versão sobe uma vez; desfazer devolve o mundo byte a byte ao de antes; sem cartório, o reset fica
  local e avisa que a versão ainda não foi espalhada).
  *Depende de:* 1.3

- [ ] **1.5 — Main e ponte: `mundo:planejar` e `mundo:resetar` com todas as recusas**
  *O que fazer:* as duas ações no processo principal (e na ponte), com as recusas **no main**, não só na tela:
  demonstração ("Isso é só uma demonstração"), servidor rodando, sem trava, backup/restauração em andamento, PC que não
  pode resetar, outro reset em andamento. Erros em texto fixo seguro (sem caminho cru, S-14). **Confirmar com o Eliel**
  quem pode resetar antes de ligar (padrão: só o dono do grupo).
  *Arquivo:* `apps/desktop/src/main/mundo.ts`, `principal.ts`, `preload.cts`, `ponte.ts`, `fake-e2e.ts`, testes
  **Tela no app:** não se aplica.
  *Confirmação:* testes do main (cada recusa; uma chamada de backup antes do reset; demonstração nunca escreve).
  *Depende de:* 1.4

- [ ] **1.6 — Tela Mundo: escolher a área, ver a prévia, confirmar, resetar, desfazer**
  *O que fazer:* nova aba **Mundo** na casca do `appuimel` bloco 2: (1) escolher a dimensão; (2) escolher a área
  **por coordenadas** (campos com unidade e "Raio em blocos ao redor de um ponto") e, ao lado, uma **grade de regiões** do
  que existe no disco para clicar e selecionar (sem mapa de terreno); (3) **prévia**: "Vai apagar 64 chunks (4,2 MB, era
  2,2 GB no total). Um backup é feito antes."; (4) **confirmação** digitando o nome do mundo; (5) progresso e resultado;
  (6) botão **Desfazer o último reset**. Botão desligado com a dica "Pare o servidor para resetar" quando estiver ligado.
  *Arquivo:* `apps/desktop/src/ui/mundo.ts`, `index.html`, `tela.css`, `navegacao.ts`, `docs/design-system.md`, e2e
  **Tela no app:** Mundo › Dimensão › Área › "Resetar…" › confirmação; "Desfazer o último reset".
  *Confirmação:* e2e (botão desligado com servidor ligado; prévia bate com o plano; confirmação errada não reseta;
  resetar e desfazer num mundo de teste); capturas claro e escuro; leitura por teclado.
  *Depende de:* 1.5 e do `appuimel` 2.2

- [ ] **1.7 — Acabamento e tutorial de teste**
  *O que fazer:* `impeccable` `audit`/`polish` na aba Mundo; tutorial passo a passo em `docs/tutoriais/chunk-resetar.md`
  (como testar com um mundo de teste, nunca o real) e linha no tutorial do ensaio do instalador.
  *Arquivo:* `apps/desktop/src/ui/mundo.ts`, `docs/tutoriais/chunk-resetar.md`, testes
  **Tela no app:** Mundo.
  *Confirmação:* e2e completo verde; no Windows com servidor Minecraft real, em mundo de teste **[P: Eliel]**.
  *Depende de:* 1.6

## Backlog deste roadmap (ideias, não entram agora)
- Escolher a área clicando num **mapa de terreno** de verdade (precisa de servidor de mapa ou gerador próprio).
- Resetar só **construções** ou só **entidades**, mantendo o terreno.
- **Agendar** reset (ex.: o Nether todo mês).
