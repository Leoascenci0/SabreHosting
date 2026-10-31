# Briefing piloto-1.1b — Ler level.dat do mundo importado (versão e plugins)

BASE: 565b9ee8d2a57f0395126af1b7218db9ef263abf · RAMO: roadmap/piloto-1.1b · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §seguranca (zip hostil, limite de descompactação), §enxugar; integridade §2 só se mexer em pacote
TRIAGEM: M7 (+M1), ~140 linhas + ~140 de teste, risco MÉDIO (parser de entrada não confiável). REAPROVEITAR: conferirLista (packages/nucleo/src/importar.ts:98) para achar plugins/ e mods/*.jar; percorrer (:60) para ler level.dat sem extrair; recusa; LIMITES_PADRAO.maxBytes (:25) como teto do descompactado; node:zlib gunzipSync({maxOutputLength}); test/ajuda/zip.ts para zips hostis. NÃO ESCREVER: biblioteca NBT de terceiros (parser mínimo cabe em ~100 linhas com limite de profundidade e de bytes); mudar extrair/conferirLista; tela (é 1.1c); tutorial; usar bytesDeterministicos de test/ajuda/mundos.ts:39 como level.dat (é lixo: gere fixture NBT gzip no teste). PASSOS: packages/nucleo/src/nbt.ts (gunzip com teto, tags 1–12, limite de profundidade/bytes, sem confiar em comprimento do arquivo; extrai Data.Version.Name e Data.Version.Id, ausente = 'desconhecida'); importar.ts lê level.dat antes de extrair, detecta plugins/ e mods/, ImportacaoPronta ganha versaoMinecraft e indicios (sem mudar enviar/extrair). PROVA: fixture válida + 3 hostis (bomba gzip, comprimento de string/lista maior que o arquivo, profundidade excessiva); importarMundoZip retorna versão e plugins.

## Item (texto literal do roadmap)
  *Arquivo:* `packages/nucleo/src/importar.ts`, `docs/tutoriais/piloto-importar.md`
  **Tela no app:** Backups › "Importar mundo".
  *Confirmação:* importar um mundo de teste; depois o real. **[P: baixar o mundo real]**
  *Depende de:* cart-1.4, app-2.1

## Decisões que valem para este item
31/10 (Eliel): importar lendo o .zip direto, dependência de zip yauzl já aprovada e fixada. Decididos pela Máxima (reversíveis): versão 'desconhecida' só AVISA (não bloqueia); zip de hospedagem com pasta-raiz única (ex.: world/) é aceito: level.dat na raiz OU dentro de uma única pasta de topo, e o resto da importação continua tratando o mesmo prefixo (se importar.ts hoje não suporta pasta-raiz, trate no menor diff e teste).

## Exigências desta rodada
- No PR, escreva as linhas `Regressão:` e `Tela no app:` (S-10), mesmo que seja "não se aplica".
- Passe pelas fichas S-06 (agendador: ++geracao antes de await), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume()), S-09 (hash completo). `grep -i` em docs/memoria/solucoes.md antes de depurar.
- Vistoria uma de cada vez (S-01). Esta é a 1.1b do corte; 1.1c (tela) vem depois. Mundo só inventado.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/piloto-1.1b.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Formato real do zip da hospedagem (pergunta ao Eliel vira P no relatório, não bloqueia).
