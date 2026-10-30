# Como contribuir

Obrigado pelo interesse! O projeto é em português do Brasil (código, commits, textos).

## Antes de começar

1. Leia o [`CLAUDE.md`](CLAUDE.md): ele tem as regras do projeto (vale para pessoas e para agentes de IA).
2. As **regras de ouro do mundo** (seção do `CLAUDE.md`) não se negociam: um host por vez, nunca copiar o mundo com o
   servidor rodando, troca atômica com hash, nunca apagar o último backup bom.
3. Escolha um item aberto num `docs/roadmap-*.md` ou uma issue com o rótulo `bom-primeiro-item`. Comente na issue
   antes de começar, para ninguém fazer o mesmo item.

## Fluxo

1. Faça um fork e crie um ramo `roadmap/<sigla>-<id>` (ou `corr/<assunto>` para correção).
2. Um item por PR. Plano curto em `docs/agentes/planos/<sigla>-<id>.md` como primeiro commit.
3. Teste antes de entregar: `npm run vistoria`. Bug corrigido vem com teste que falhava antes.
4. Abra o PR pelo modelo (`.github/pull_request_template.md`), dizendo também o que **não** conseguiu confirmar.
5. Ative a trava local uma vez: `git config core.hooksPath .githooks`.

## Nunca

- Segredo (token, chave, senha) no código; mundo real de Minecraft no repositório; jar ou executável no git.
- Abrir porta no PC dos usuários; baixar arquivo sem conferir o hash.

Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).
