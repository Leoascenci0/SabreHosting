# Plano app-1.3c-i — Endereço/token do cartório e pasta-base saem do ambiente; `abrirJogo` ligado

Corte da Máxima (M1+M5): só o que o briefing lista. Fora: "Criar convite"/Validade (1.3c-ii), instalar Java/NeoForge.

## Desenho
1. `boas-vindas.ts`: grava também `portaCartorio` (do convite) em `boas-vindas.json`; exporta `lerSalvo`. Nunca grava token.
2. `config-pc.ts` (novo, sem Electron): `lerConfigPc(dados, cofre, env)` junta (a) grupo/porta/pasta-base gravados pelo
   assistente, (b) token do **cofre real**, (c) `SABRE_JAVA`/`SABRE_NEOFORGE` (instalador ainda não existe). Deriva
   `urlCartorio = http://<IP do hub>:<porta>`, `servidor\`, `servidor\world`, `mundos\` (backups). Sem assistente
   concluído ou sem grupo: campos ausentes → app responde "sem grupo"/"não configurado" como hoje. `SABRE_ENDERECO`,
   `SABRE_CARTORIO_*` e `SABRE_PASTA_*` deixam de ser lidos fora do E2E (que usa `fake-e2e`, não passa por aqui).
3. `deps-reais.ts`: `clienteDoPc(config)` e `depsReais(config, copiar, extras)` tipados (sem `env`). Endereço do Jogar =
   `GET /grupo` (cacheado, `atualizarEndereco()` antes do Jogar; cai no gravado). `abrirJogo` ligado: `detectarPrism`
   (auto) → instância `idDaInstancia(grupo)` → núcleo.
4. `abrir.ts` (núcleo): recebe `pastaInstancias` + `idInstancia`; o marcador é `<pastaInstancias>/<id>/SabreHosting`,
   derivado do MESMO id (id de outra instância ⇒ sem marcador ⇒ recusa). `instancia.ts`: `idDaInstancia(grupo)`.
5. Mods da instância (lancmel-2.1): `pastaModsDaInstancia` acha `minecraft\mods`/`.minecraft\mods` da instância do grupo;
   nunca cria pasta no Prism do amigo.
6. `principal.ts`: lê a config uma vez no arranque (depois do cofre); consumidores antigos (backups, espalhar, servidor de
   arquivos, versão, importar, grupo) recebem o `ambienteLegado(config)` — mesma forma `SABRE_*`, mas montada da config, nunca
   de `process.env`. Ao concluir o assistente, o app reinicia (config é lida no arranque). E2E segue com os falsos.
7. Tela: `Configurações › Grupo › Endereço do servidor` (só leitura, vindo do cartório, visível a todos).

## Testes (falham antes)
- config-pc: sem env nenhum, lê porta+pasta do json e token do cofre; sem cofre/sem grupo → vazio; porta torta ignorada.
- deps-reais: sem `SABRE_*` no ambiente, `eu()` chama o cartório com o token do cofre; Hospedar usa `base\servidor`;
  endereço vem do `/grupo`; `abrirJogo` chama Prism com id/pasta da mesma instância; Prism ausente/antigo → mensagem.
- abrir: id de outra instância (marcador só na A, pede B) recusado; `..` recusado.
- grupo: endereço no estado para dono e não-dono; falha do cartório não derruba a lista.
- boas-vindas: `portaCartorio` gravada e preservada no `concluir`.

## Riscos / [P]
Relançar o app depois do assistente, o id real que o Prism dá à instância e a pasta `minecraft\mods` só se provam num
Windows com Prism. Mensagens de tela sem caminho/IP/token.
