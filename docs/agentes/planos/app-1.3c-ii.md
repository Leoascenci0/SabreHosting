# Plano app-1.3c-ii — Botão "Criar convite" no PC do dono

Base `fb402e9` · ramo `roadmap/app-1.3c-ii` · método M5+M1 (a rota `POST /convites` e `cliente.criarConvite` já existem).

## O que entra
1. `apps/desktop/src/main/grupo.ts`: `criarConvite(entrada)` no `criarGrupo`.
   - Revalida no cartório que este PC é o dono (`eu()`); não-dono: recusa fixa, sem chamar `criarConvite`.
   - Validade só da lista fechada **1 hora (padrão) / 1 dia / 3 dias** (24 h e 72 h: o cartório limita a 72 h; 7 dias
     do briefing é "ex." e passaria do teto do cartório).
   - Nome digitado vira o formato da rede (minúsculas sem acento, números e hífen, até 32); a tela mostra como ficou.
   - Uma criação por vez; erros por status (403/409/503/outros) com texto fixo em pt-BR (S-14): nunca a mensagem bruta.
   - O texto do convite só passa pelo retorno: nunca gravado, nunca em log; resposta torta do cartório vira erro fixo.
2. IPC `sabre:grupo:criar-convite` (main revalida), `preload.cts`, tipos em `ui/ponte.ts`.
3. Tela (`index.html` + `configuracoes.ts`), em Configurações › Grupo: nome do PC, validade, "Criar convite";
   resultado com texto selecionável, "Copiar" e "vale até …". O texto some ao recarregar a área ou sair da tela.
4. `fake-e2e.ts`: cartório falso (registra só nome e horas).
5. Principal: liga `criarConvite` ao `clienteDoPc` (nenhuma rota nova).

## Testes (TDD, falham antes)
- `grupo.test.ts`: dono cria (nome normalizado, validade, texto devolvido); não-dono não chega ao cartório; validade fora
  da lista e nome vazio recusados; 403/409/503/erro bruto viram texto fixo; texto nunca vai a `console`; uma por vez.
- e2e (`configuracoes.e2e.ts`): dono cria e copia (área de transferência); amigo não vê o formulário.

## Fora do corte
Atalho `sabre://`, tela de entrada do amigo, validade configurável nas Configurações (outro item).

## Linhas finais do PR
Tela no app: "Configurações › Grupo › Criar convite". Regressão: item novo; testes novos cobrem a recusa ao não-dono.
