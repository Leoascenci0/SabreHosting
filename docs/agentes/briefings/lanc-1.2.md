# Briefing lanc-1.2 — Instância do grupo no Prism

BASE: 35cd321a49277d8ce275cb5c9c922bcba2eb5ca6 · RAMO: roadmap/lanc-1.2 · MODELO: sonnet · ISSUE: #56
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §3; cabeçalho de docs/roadmap-lanc.md (regra GPL); `launcher/prism.ts`
TRIAGEM: M7 (gerador de `.mrpack` — formato público documentado pelo Modrinth; reaproveita `detectarPrism` do lanc-1.1
para achar a pasta de instâncias e a lib `tar`? não: `.mrpack` é zip — use só Node nativo? Node não escreve zip;
decida entre (a) gerar a pasta da instância direto no formato de instância do Prism SE houver documentação pública do
formato, ou (b) gerar `.mrpack` com uma dependência pequena de zip MIT/ISC registrada em DECISOES — justifique no PR) ·
~150 linhas (+~150 teste) · risco médio · MIÚDO: não. NÃO ESCREVER: código ou trecho do Prism (GPL-3.0); download de
mods (é o lanc-1.4); execução do Prism (lanc-1.3). PASSOS: 1) `packages/nucleo/src/launcher/instancia.ts`:
`montarInstancia({grupo, versaoMinecraft, versaoNeoForge, mods: []})` PURA → conteúdo do pacote (`modrinth.index.json`
com `formatVersion: 1`, `game: "minecraft"`, `dependencies: {minecraft, neoforge}`, `name: "SabreHosting — <grupo>"`);
2) `gravarInstancia(...)` grava com troca atômica numa pasta temporária e devolve o caminho do `.mrpack` (ou da pasta);
3) a instância do SabreHosting é identificada por um marcador próprio; nunca toca em outra instância (teste com uma
instância "do amigo" na mesma pasta falsa); nome do grupo higienizado para nome de pasta (reaproveite as regras de
nome do Windows do manifesto, se servirem).
PROVA: teste gera a instância numa pasta falsa; JSON conforme o formato documentado; instâncias alheias intactas;
regerar é idempotente; nome de grupo com caracteres inválidos higienizado.

## Item (texto literal do roadmap)
- [ ] **1.2 — Instância do grupo no Prism**
  *O que fazer:* criar e manter atualizada uma instância "SabreHosting — <grupo>" com a versão do Minecraft e o loader do
  servidor (vindos do cartório), pelo formato de instância ou importação `.mrpack` documentados. Nunca mexer nas
  outras instâncias do amigo.
  *Arquivo:* `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste gera a instância numa pasta falsa; conferência manual no Prism real. **[P: teste no PC]**
  *Depende de:* lanc-1.1, cart-1.3 · D1 e D5 decididas (loader NeoForge)

## Decisões que valem para este item
- D1 Java; D5 NeoForge (+ Sinytra Connector como mod, entra no lanc-1.4). Versões vêm do cartório (parâmetros).
- CLAUDE.md › Launcher: nunca copiar código GPL; só formatos documentados.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lanc-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #56` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Se a única saída for uma dependência com licença não permissiva (GPL), pare e pergunte.
