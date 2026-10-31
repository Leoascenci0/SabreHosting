# Briefing lanc-2.3 — Baixar e montar a versão do jogo

BASE: 68cd21426b6bad17d5cddb759d7cd6c841296916 · RAMO: roadmap/lanc-2.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade (mundo/backup); seguranca (download)
TRIAGEM: dispensada pela sessão de onda (item pequeno e já descrito); escolha o método mais curto (M1 reaproveitar) e escreva uma vez só.

## Item (texto literal do roadmap)
- [ ] **2.3 — Baixar e montar a versão do jogo**
  *O que fazer:* a partir do manifesto oficial de versões, baixar cliente, bibliotecas, assets e Java com hash conferido,
  em cache compartilhado; nada distribuído pelo SabreHosting.
  *Arquivo:* `packages/nucleo/src/launcher/montar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com manifesto falso; versão real montada no PC. **[P: teste no PC]**
  *Depende de:* base-1.1

## Decisões que valem para este item
Autorização de 31/10: "Pode, e siga sozinha". Eliel ausente: item com P vira entrega parcial + ⏸️, sem esperar.
Faça só o que testa na nuvem com download SIMULADO (manifesto falso, servidor HTTP local, hash conferido, cache compartilhado, troca atômica). Nada distribuído pelo SabreHosting; hash sempre conferido antes de usar. A parte 'versão real montada no PC' fica P: relate no PR como não confirmada. Se não der para testar sem internet real, pare e relate para ⏸️.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lanc-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada que apague mundo/backup além do já descrito; assinatura/certificado (D9) fica com o Eliel.
