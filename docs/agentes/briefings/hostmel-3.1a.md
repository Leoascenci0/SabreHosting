# Briefing hostmel-3.1a — Núcleo: versões do Minecraft do manifesto oficial

BASE: 4dd08dee84bd5fd4b618490dabe2d3df1bc030de · RAMO: roadmap/hostmel-3.1a · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade §2 (versão), §seguranca (download, rede), §enxugar
TRIAGEM (corte da Máxima: este é o 3.1a, SÓ núcleo; 3.1b cartório e 3.1c tela ficam para a próxima onda), M7 (+M1 nos resolvedores, +M3 no processo), ~220 linhas + ~200 teste, risco ALTO (download de jar).
FAZER: novo packages/nucleo/src/servidor/versoes.ts: lista de versões do manifesto oficial da Mojang (só tipo release, da mais nova à mais antiga) e plano por versão com sha1 do server.jar e javaVersion.majorVersion do JSON da versão. Em servidor/resolvedores.ts entra resolverMojang no molde de resolverModrinth (:37) usando alvo(). servidor/processo.ts (:300–390) ganha o modo 'jar' (-jar server.jar) além do modo NeoForge (@args). Java pela resolverAdoptium (:28) com a versão maior vinda do JSON. Função 'o que dá em cada versão': NeoForge só quando existir para aquela versão (a partir da 1.20.1), Fabric+Forge juntos pelo Connector só em faixa que o Connector suporta, ou 'sem mods' (fallback sempre disponível).
DECISÕES DA MÁXIMA (reversíveis): suporte a loaders por CONSULTA na hora (Maven/Modrinth, fetch injetável) com 'sem mods' como fallback se a consulta falhar — não tabela fixa; 'um tipo só' = NeoForge (já fixado no hostmel-1.1); o sha1 do server.jar vem do manifesto no momento da escolha e é devolvido junto do plano (o cartório o guarda no 3.1b).
NÃO ESCREVER: campo em preferencias; tabela fixa de hashes por versão (HASHES_NEOFORGE continua como está); função nova de backup; validação de caminho nova; tela; cartório. O projeto NUNCA distribui jar: baixa da fonte oficial no PC do usuário e confere o hash; EULA já tratado no app.
PROVA: manifesto de TESTE em tests/ (sem rede nos testes); versão sem Connector não oferece Fabric+Forge; sha1 errado recusa E apaga o arquivo baixado; versão fora da lista recusada; modo jar sobe com o comando certo (testado sem Java real, como o vizinho); URL do download só de hosts oficiais (https, allowlist) — entrada do manifesto é não confiável (S-07).

## Item (texto literal do roadmap)
- [ ] **3.1 — Qualquer versão do Minecraft, escolhida pelo dono** (decisão do Eliel, 31/10/2026)
  *O que fazer:* lista de versões do Minecraft (da mais nova às antigas) vinda do manifesto oficial da Mojang; para cada
  uma, o que o servidor consegue rodar: NeoForge + Sinytra Connector (Fabric e Forge juntos), um loader só, ou sem mods.
  A versão escolhida vai para a configuração do grupo no cartório (todos os PCs usam a mesma); trocar de versão só com o
  servidor parado e backup feito antes. Hashes por versão (hostmel-1.1) e Java certo para cada versão.
  *Arquivo:* `packages/nucleo/src/servidor/`, `services/cartorio/src/`, `apps/desktop/src/ui/configuracoes.*`
  **Tela no app:** Configurações › Servidor › Versão (só o dono); padrão 1.21.1.
  *Confirmação:* teste: versão sem Connector não oferece Fabric+Forge; trocar versão com servidor rodando é recusado.
  *Depende de:* app-2.2 ✅ · pode virar 2–3 itens na triagem (nucleo, cartório, tela).

## Decisões que valem para este item
- 31/10 (Eliel): o dono escolhe qualquer versão, da mais nova às antigas; ao lado o app mostra o que dá em cada uma; padrão inicial 1.21.1.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-3.1a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), services/cartorio, apps/desktop, máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Qualquer dependência nova; distribuir jar.
