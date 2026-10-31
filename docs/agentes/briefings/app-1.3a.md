# Briefing app-1.3a — Parser do convite + cofre real (corte 1/3 do app-1.3)

BASE: 2b3560a4b1fec54a7f20e00cb0ea61dc7e40d355 · RAMO: roadmap/app-1.3a · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; seguranca (segredo, rede); integridade (não usar o token se o convite falhar)
TRIAGEM: M7 (parser) + M6 (safeStorage do Electron) ; ~220 linhas com teste; risco alto (segredo). Corte do app-1.3 em a/b/c:
 a (ESTE): parser do texto `sabre://convite/1.…` (packages/nucleo, puro: formato e prazo) + Cofre com safeStorage no main (`apps/desktop/src/main/cofre.ts`, novo; recusa guardar sem cofre disponível). b (assistente Convite→EULA→Pasta) e c (Criar convite/endereço/tirar SABRE_ENDERECO) são outros itens: NÃO fazer.
 REAPROVEITAR: services/cartorio/src/convite.ts (emitirConvite gera o texto: o parser tem de ler exatamente esse formato; leia-o e o desenho em docs/superpowers/specs/2026-10-31-convite-do-grupo-design.md §5.2, §6); cartorio/cofre.ts (interface Cofre, cofreEmMemoria); cartorio/tipos.ts validadores.
 NÃO ESCREVER: nada no cartório; nenhum assistente/tela; não ler sabre:// no cartório.
 Arquivos novos sugeridos: packages/nucleo/src/rede/convite.ts (+teste), apps/desktop/src/main/cofre.ts (+teste com safeStorage falso).

## Item (texto literal do roadmap, parte a)
app-1.3 (docs/roadmap-app.md): "(1) Convite: colar o texto `sabre://convite/1.…`; conferir formato e prazo antes de tudo; … token no cofre real (`safeStorage`, implementando a interface `Cofre`); sem cofre, recusa e explica."
*Confirmação (da parte a):* teste: convite vencido, torto → mensagem clara em pt-BR e nada muda; sem cofre não guarda token; o texto do convite e o token nunca aparecem em log/erro. **Tela no app:** não se aplica nesta parte (a tela é o app-1.3b).

## Decisões que valem para este item
Desenho aprovado pelo Eliel em 31/10/2026 (spec acima). Conta só pela Microsoft etc. não se aplica.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-1.3a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); texto do convite gerado por emitirConvite no teste
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo, Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Tela no app:` ("não se aplica; é o app-1.3b")

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos. Não tocar principal.ts, packages/nucleo/src/sync, launcher.

## O que NÃO decidir
Qualquer mudança no formato do convite (é do cartório já mergeado): se o parser não bater, avise a orquestradora.
