# Briefing app-2.2 — Tela de configurações (+ Tirar PC do grupo)

BASE: ae178b897fb09a9e6761d2a6b8e36cc877576be7 · RAMO: roadmap/app-2.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable (audit e polish antes de entregar)
LEIA: qualidade-sabre §1; interface; enxugar; seguranca (IPC, ação que tira acesso de alguém)
TRIAGEM: M5+M2 (+M1) ~400 linhas + ~200 de teste (cart-2.1 estimou 180, real 420: estime com folga), risco alto (cartório na tela 'Tirar PC'). Reaproveitar apps/desktop/src/main/preferencias.ts (lerPreferencias/salvarPreferencias, escrita atômica; ESTENDER, não criar outro arquivo), packages/nucleo/src/servidor/configurar.ts (validarFaixa, distância de visão/simulação), packages/nucleo/src/cartorio/cliente.ts (criarCliente, ErroCartorio → novo método revogarPc), ui/ponte.ts + ui/tela.ts + a tela de backups do app-2.1 (molde), contrato pronto em services/cartorio (POST /pcs/:id/revogar: 204 ok, 403 não-dono, 409 dono, 404 inexistente). A pasta src/telas/ NÃO existe: a tela vai em apps/desktop/src/ui/configuracoes.* (decidido). Não escrever: validação de faixa nova, armazenamento de config paralelo, cliente do cartório do zero, trava de dono (o cartório já decide). CORTE PARA CABER NUM CHAT — ENTRA: Geral › Abrir com o Windows; Servidor › distância de visão e de simulação; Backups › intervalo e quantos guardar (SÓ se o armazenamento da preferência existir e os consumidores em backup/agendador.ts e rotacao.ts puderem lê-la sem mudar comportamento; senão deixe de fora e diga no PR); Grupo › Tirar PC do grupo (só dono). FICA PARA DEPOIS (a Máxima abre itens appmel): hospedar, memória máxima, pasta, criar convite/validade/endereço, atualizar sozinho, Prism, folga de troca, quem pode entrar, banda, histórico.

## Item (texto literal do roadmap)
- [ ] **2.2 — Tela de configurações**
  *O que fazer:* reunir os campos criados nos outros itens (Geral, Servidor, Backups, Grupo), com valores padrão e validação.
  *Arquivo:* `apps/desktop/src/telas/configuracoes.*`
  **Tela no app:** este item é a própria tela.
  *Confirmação:* E2E: valor inválido não salva; valor salvo chega ao núcleo.
  *Depende de:* app-1.1
  + (cartmel-1.1) **Tela no app:** Configurações › Grupo › "Tirar PC do grupo" (só o dono do grupo).

## Decisões que valem para este item
DECISOES 2026-10-31: quem tira um PC do grupo é SÓ O DONO, pelo app; o dono não se tira sem passar a posse (trocar-dono); o PC tirado perde acesso ao cartório. Na tela: lista dos PCs do grupo (use a rota de grupo do cartório; confirme que o app consegue saber se este PC é o dono — se não der, mostre o botão só quando o cartório disser que é dono e trate o 403 com mensagem clara), confirmação que diz o NOME do PC, mensagem pt-BR para 403/409/404, estado de 'carregando', e texto avisando que o PC tirado precisa de novo convite. Sem termo técnico na tela.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/app-2.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Quais campos entram (já cortado acima); 'Pasta do SabreHosting' (precisa de decisão do Eliel: NÃO inclua); mudar a rota do cartório.
