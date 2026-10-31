# Briefing drive-1.2 — Tutorial: ligar o Google Drive para Computador

BASE: 68cd21426b6bad17d5cddb759d7cd6c841296916 · RAMO: roadmap/drive-1.2 · MODELO: haiku
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › integridade (mundo/backup); seguranca (download)
TRIAGEM: dispensada pela sessão de onda (item pequeno e já descrito); escolha o método mais curto (M1 reaproveitar) e escreva uma vez só.

## Item (texto literal do roadmap)
- [ ] **1.2 — Tutorial: ligar o Google Drive para Computador**
  *O que fazer:* passo a passo para instalar o Drive para Computador e apontar o app para a pasta.
  *Arquivo:* `docs/tutoriais/drive-historico.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel vê os pacotes aparecendo no Drive. **[P: teste no PC]**
  *Depende de:* drive-1.1

## Decisões que valem para este item
Autorização de 31/10: "Pode, e siga sozinha". Eliel ausente: item com P vira entrega parcial + ⏸️, sem esperar.
Só texto em pt-BR para leigo (engenheiro civil que não programa), sem sigla sem abrir. Confira em src (destino pasta, Configurações › Backups › Histórico longo numa pasta) os nomes reais dos campos. A confirmação no PC fica P: dizer no PR.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/drive-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, linhas Regressão:/Tela no app: quando couber, e Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada que apague mundo/backup além do já descrito; assinatura/certificado (D9) fica com o Eliel.
