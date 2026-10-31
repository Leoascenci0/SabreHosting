# Plano syncmel-1.10 — servir os arquivos do mundo no app

Triagem (M1, reaproveitar): `servirArquivos` (transferencia.ts) e o padrão `ligarEspalharDoApp` (#192) já existem; falta
**ligar**. Estimativa ~170 linhas + testes.

## Desenho
1. **Fonte só de pacote fechado (regra de ouro 2).** Novo `packages/nucleo/src/sync/vitrine.ts`: `criarVitrine(pasta)`
   abre (`abrirPacote`, que confere o hash do pacote e de cada arquivo) o último backup marcado "bom" numa pasta própria
   do app e indexa `sha256 → arquivo` (os arquivos do manifesto + o próprio `manifesto.json`, que o cliente pede pelo
   `manifestoSha256`). Troca atômica: abre numa pasta nova, só então troca o índice e apaga a pasta velha. O servidor
   nunca vê a pasta do mundo vivo; `arquivos(hash)` só devolve o que está no índice.
2. **Escuta só na rede privada.** O IP do PC vem das interfaces de rede, na faixa 10.66.0.2–199 (`conferirEnderecoPrivado`);
   sem IP nessa faixa, sem token ou sem cartório: não liga e avisa no log. Nunca 0.0.0.0.
3. **Token conferido pelo cartório.** `conferirToken` chama `GET /eu` com o token do PEDIDO (cliente do cartório com cofre
   daquele token): 401/403 → `null`; falha de rede → lança (o servidor responde 503).
4. **Ligação no app** (`apps/desktop/src/main/servir-arquivos.ts` + `principal.ts`): liga no arranque, publica a vitrine
   no arranque e depois de cada backup bom; fecha ao sair. Um só servidor e uma publicação por vez (S-06).
5. **Notas do qa do #192:** `fontesDeCopias` ignora IP fora da faixa (hoje um IP estranho derruba a rodada);
   o disparo do espalhar também roda depois de backup bom; teste de `ligarEspalharDoApp` (extraída para função testável).

## Testes (primeiro, falham antes)
- vitrine: pacote bom → serve manifesto e arquivo por hash; hash do manifesto = `PacoteCriado.manifesto.sha256`;
  hash desconhecido/caminho → `undefined`; pacote adulterado não publica e mantém a vitrine anterior; troca apaga a velha.
- `fontesDeCopias` com IP estranho: ignora só ele.
- servidor do app: recusa endereço fora da rede privada; 2 PCs simulados (mundo inventado): um serve, o outro atualiza.
- conferirToken: 200 → id; 401 → null; rede caindo → lança.

## Fora do alcance
Tela de banda (1.9b). ui/configuracoes e troca de versão (hostmel-3.2). CLAUDE.md, .claude/, roadmaps, MILESTONE.
