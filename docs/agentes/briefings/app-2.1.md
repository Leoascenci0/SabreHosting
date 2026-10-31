# Briefing app-2.1 — Tela de backups e restaurar

BASE: bdee52012c7fe65fea5ad11a54b8a400f47523e5 · RAMO: roadmap/app-2.1 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit e polish antes de entregar)
LEIA: qualidade-sabre §1; interface; integridade (restaurar); seguranca (IPC/preload)
TRIAGEM: M5 (+M1, +M7 na listagem) ~200 linhas + ~150 de teste, risco alto (restaurar). Reaproveitar restaurarBackup (packages/nucleo/src/backup/restaurar.ts:75, já faz trava/parado/hash/troca atômica/backup do atual — NÃO mudar), nomeDoBackup (backup/agendador.ts), Manifesto.criadoEm e arquivos[].tamanho (soma), confirmação modal de apps/desktop/src/main/principal.ts (~36-46, parametrizar com nome e data), IPC com permitir(evento) (principal.ts ~175), molde de tela apps/desktop/src/ui/tela.ts e ponte.ts, E2E em apps/desktop/e2e/. Passos: listagem no núcleo (ler pastaBackups, abrir manifesto de cada pacote, devolver nome/data/tamanho); IPC sabre:backups:listar e :restaurar com permitir(); tela backups.* com confirmação que diz nome e data; botão desligado com servidor rodando; E2E: cancelar não altera nada, confirmar chama restaurarBackup. Não escrever: lógica de restauração/hash/trava, nova caixa de confirmação, infra de E2E nova.

## Item (texto literal do roadmap)
- [ ] **2.1 — Tela de backups e restaurar**
  *O que fazer:* lista (data, tamanho, de quem), restaurar com confirmação que diz nome e data.
  *Arquivo:* `apps/desktop/src/telas/backups.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: cancelar não muda nada; confirmar chama `restaurar` do núcleo.
  *Depende de:* app-1.1, bkp-2.2

## Decisões que valem para este item
DECIDIDO pela Máxima (reversível, 'decidi por você'): o manifesto não tem campo de autor e NÃO se muda o formato do pacote (integridade). A coluna 'De quem' mostra 'Este PC' para backup feito aqui; backup recebido de outro PC (sync) fica para depois. Restaurar faz backup do estado atual antes (regra de ouro 4, já no núcleo) e a tela avisa isso na confirmação.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (item de rede/serviço: ver S-03 no CLAUDE.md se tocar infra/)
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Mudar o formato do manifesto/pacote; qualquer coisa fora de apps/desktop e da função de listagem no núcleo.
