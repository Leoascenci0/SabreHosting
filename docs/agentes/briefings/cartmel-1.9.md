# Briefing cartmel-1.9 — Acabamentos do cliente do cartório

BASE: 0966655c5da7c2d75f786b89349e81b30f0299d3 · RAMO: roadmap/cartmel-1.9 · MODELO: sonnet (gatilho Opus: nenhum) · ISSUE: #140
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1, §seguranca (log)
TRIAGEM (Máxima): M4 | ~20 linhas + ~40 de teste | RISCO médio | ONDE: packages/nucleo/src/cartorio/cliente.ts:~170 (as {erro} → ErroCartorio) e lerJson (teto 64 KB com content-length + contagem em fluxo); tipos.ts:~109 texto(o,'erro') na recusa; validação de ConviteUsado/EntradaNoGrupo | PASSOS: 1. cortar erro em 200 caracteres (com reticências) nos dois lugares; 2. teste do content-length > 64 KB com corpo-espião que registra se foi lido (prova 'nem é lido'); 3. resposta {token} sem pacote (convite antigo) → ErroCartorio com texto claro 'Este convite é de uma versão antiga do cartório; peça um convite novo ao dono do grupo.' | NÃO ESCREVER: mudança no cartório (services/) | PROVA: mutações: tirar o corte, tirar o teste do content-length antes da leitura → testes caem.

## Item (texto literal do roadmap)
- [ ] **1.9 — Acabamentos do cliente do cartório**
  *O que fazer:* cortar em ~200 caracteres o campo `erro` vindo do cartório antes de pôr no `ErroCartorio` e na recusa
  da trava (vai para o log e para a tela); o teste "content-length acima de 64 KB nem é lido" passa a provar que o corpo
  não foi lido (hoje a contagem por fluxo também barra e o teste não distingue); convite antigo sem `ip_prov` (só
  `{token}`) recusado com mensagem clara em vez de "resposta inválida".
  *Arquivo:* `packages/nucleo/src/cartorio/cliente.ts`, `packages/nucleo/src/cartorio/tipos.ts`, testes
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso (falham antes, passam depois).
  *Origem:* cartmel-2.1 · PR #123 · qa segurança + qa integridade + filha

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cartmel-1.9.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) — ou, no ícone, as imagens geradas e mostradas no PR
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #140) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar PNG de captura), máquina da nuvem real, segredo. Só packages/nucleo/src/cartorio/.

## O que NÃO decidir (perguntar à orquestradora)
nada
