# Plano piloto-1.1c — Tela Backups › Importar mundo + tutorial

Escopo: ligar o `importarMundoZip` (1.1a/b) ao cartório e à tela. Base 7e7b64e. Método M5 (+M3 cliente, +M3 tutorial).

## Desenho

1. **Núcleo — cliente do cartório** (`cartorio/cliente.ts`, diff localizado):
   - `numeroMaisNovo()` → `GET /versoes/mais-nova` (repete), devolve só o número ou `null`.
     (A cartmel-2.4 traz `maisNova()` completo; depois das duas na `main`, um vira o outro: ver "Melhorias".)
   - `criarVersao(epoca, {manifestoSha256, arquivos, bytes})` → `POST /versoes` → `201 {numero}`. Não repete
     (cada tentativa criaria outra versão).
   - `enviarPacote(numero, epoca, {caminho, sha256, tamanho}, sinal?)` → `PUT /versoes/:n/pacote?epoca&sha256&bytes`,
     corpo `application/octet-stream` em fluxo (nunca o arquivo inteiro na memória), prazo proporcional ao tamanho,
     não repete. Confere que o `201` devolve o mesmo sha256 e bytes (a nuvem guardou o que foi mandado).
   - `Pedido` ganha `fluxo?` (caminho + bytes); o resto de `uma()`/`chamar()` fica igual.
2. **Núcleo — pacote** (`backup/pacote.ts`): `PacoteCriado` ganha `manifesto: {sha256, arquivos, bytes}` (hash do
   `manifesto.json` exato que entrou no pacote). É o `manifestoSha256` que o `POST /versoes` exige.
3. **Núcleo — importar** (`importar.ts`):
   - `analisarZip(zip)`: só leitura (lista conferida + versão do Minecraft + indícios), para a tela mostrar antes.
   - `importarMundoZip` ganha `versao` (padrão 1): o manifesto leva o número que o cartório vai dar.
   - `importarNoCartorio(zip, {cliente, pastaDeTrabalho, aceitarVersaoNova})`:
     1. pega a trava de host normal com um `Renovador` (recusa se outro PC tem; nunca contorna);
     2. com a trava: lê o número mais novo `N`; se `N` existe e o amigo não confirmou → recusa; se `N` existe e este PC
        não é o dono → recusa (decisão 2);
     3. `importarMundoZip` com `versao = N+1` (ou 1), e no `enviar`: confere a trava, `criarVersao`, confere que o
        número é o esperado, renova, `enviarPacote`;
     4. `finally`: solta a trava sempre (também em erro). Perdeu a trava → aborta o envio.
4. **App — main** (`main/importar.ts` novo + `principal.ts`, `preload.cts`, `ui/ponte.ts`):
   - `sabre:importar:escolherZip`: diálogo do Windows (só `.zip`), analisa, guarda o caminho NO MAIN e devolve à tela
     só nome, versão do Minecraft, avisos, se já há versão no grupo e se este PC é o dono. A janela nunca manda caminho.
   - `sabre:importar:executar` (`confirmado: boolean`): recusa com servidor rodando, restauração em curso, importação
     em curso ou sem arquivo escolhido; chama `importarNoCartorio`.
5. **Tela** (`ui/index.html`, `ui/importar.ts`, `tela.css` se preciso): na tela Backups, botão "Importar mundo" →
   painel com o arquivo escolhido, versão detectada, avisos de plugins/mods, e confirmação. Com versão no grupo: só o
   dono vê o botão de confirmar, com o texto forte "isto vira a versão mais nova do grupo; o mundo atual continua
   guardado nos backups". Progresso com `aria-busy`, botões desligados durante a ação.
6. **Tutorial** `docs/tutoriais/piloto-importar.md`: pt-BR, sem jargão; como baixar o mundo no painel da hospedagem e
   importar.

## Regras de ouro
1 (trava normal, solta sempre), 2 (não toca o mundo local), 3 (zip → temporária → pacote com hash, cartório confere),
4 (nada apagado: versão N+1, backups intactos), 6 (mundo inventado nos testes).

## Testes
- Cliente: `criarVersao` (201 → número; 409 → erro com a mensagem), `enviarPacote` (fluxo, cabeçalhos, query,
  hash conferido; resposta com hash diferente → erro), `numeroMaisNovo`.
- Integração com cartório de verdade (127.0.0.1, armazém em pasta temporária): mundo inventado vira versão 1 e o
  pacote guardado bate o hash; segunda importação vira 2 só com confirmação e só pelo dono; trava com outro PC →
  recusa e nada registrado; zip hostil → recusa sem versão nova e sem gravar; trava solta no fim (também em erro).
- Main: `executar` recusa servidor rodando / sem escolha / em curso; o caminho nunca vem da janela.
- E2E: tela Backups › Importar mostra versão e avisos; sem dono com versão existente não há botão de confirmar.
