# Briefing app-3.1 — Instalador Windows e versão no GitHub Releases

BASE: 68cd21426b6bad17d5cddb759d7cd6c841296916 · RAMO: roadmap/app-3.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade (mundo/backup); seguranca (download)
TRIAGEM: dispensada pela sessão de onda (item pequeno e já descrito); escolha o método mais curto (M1 reaproveitar) e escreva uma vez só.

## Item (texto literal do roadmap)
- [ ] **3.1 — Instalador Windows e versão no GitHub Releases**
  *O que fazer:* electron-builder (NSIS) gerado no GitHub Actions (runner Windows) ao criar tag; checksums publicados.
  *Arquivo:* `.github/workflows/versao.yml`, `apps/desktop/electron-builder.*`
  **Tela no app:** não se aplica.
  *Confirmação:* tag de teste gera o instalador; o Eliel instala num PC. **[P: teste no PC]**
  *Depende de:* app-1.2, base-1.2

## Decisões que valem para este item
Autorização de 31/10: "Pode, e siga sozinha". Eliel ausente: item com P vira entrega parcial + ⏸️, sem esperar.
Só configuração/scripts validáveis na nuvem (electron-builder config NSIS, workflow versao.yml em tag, checksums SHA-256 publicados, teste que valida o YAML/config). Sem assinatura de código (D9 é do Eliel). Sem criar tag nem release de verdade. Se não der para validar, ⏸️ P.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-3.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada que apague mundo/backup além do já descrito; assinatura/certificado (D9) fica com o Eliel.
