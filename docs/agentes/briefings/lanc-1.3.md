# Briefing lanc-1.3 — Botão Jogar abre o jogo já conectado

BASE: 2b3560a4b1fec54a7f20e00cb0ea61dc7e40d355 · RAMO: roadmap/lanc-1.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; seguranca (processo externo, argumentos); interface (botão com estado de carregando)
TRIAGEM: M1 (+M7) ; ~100–150 linhas com teste; risco médio. REAPROVEITAR detectarPrism e execReal (packages/nucleo/src/launcher/prism.ts:77,:169, ExecArquivo injetável); marcador da instância já existe em instancia.ts (temMarcadorSabre, lancmel-1.1; usar ao abrir: só abrir instância com o marcador, nunca outra do amigo). abrir.ts é módulo novo. Teste com executável falso conferindo os argumentos (aberta a instância do grupo + entrar direto no endereço do proxy; sem shell, argumentos em lista, endereço validado antes de ir à linha de comando). Endereço do proxy: pelo que o app já tem (deps do Jogar); NÃO mexer em SABRE_ENDERECO/deps-reais (é do app-1.3c). Prism aberto: reaproveitar (se a CLI do Prism permitir; comportamento só de docs oficiais, NUNCA copiar código GPL do Prism).
 Ligação na tela: o botão Jogar existente (apps/desktop/src/telas ou ui inicio.*; ache o vizinho) chama abrir; falha mostra mensagem clara em pt-BR.

## Item (texto literal do roadmap)
**1.3 — Botão Jogar abre o jogo já conectado** — chamar o Prism pela linha de comando para abrir a instância do grupo e entrar direto no endereço do proxy; se o Prism estiver aberto, reaproveitar.
*Arquivo:* packages/nucleo/src/launcher/abrir.ts, apps/desktop/src/telas/inicio.* (ou o equivalente real em apps/desktop)
**Tela no app:** não se aplica.
*Confirmação:* teste com executável falso confere os argumentos; no PC, o jogo abre no servidor. **[P: teste no PC — NÃO bloqueia; entregue o código + teste, e deixe no PR a linha "P: conferir no PC com Prism real"]**

## Decisões que valem para este item
D5 e versão do Minecraft (docs/ops/DECISOES.md); nada que mude aqui.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lanc-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo, Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Tela no app:`

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos, cartório, sync, principal.ts além do mínimo para ligar o botão (se precisar tocar principal.ts, mudança mínima e avisar).

## O que NÃO decidir
Nada; se o Prism real for necessário, é P.
