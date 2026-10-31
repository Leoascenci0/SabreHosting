# Briefing appmel-1.13 — Campo "Pasta do SabreHosting" e fundir os pedidos de administrador

BASE: 99a76e04339b32b5a917c9af63160e5eacb8c8bb · RAMO: roadmap/appmel-1.13 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre, impeccable
LEIA: qualidade-sabre §1, integridade, seguranca, interface
TRIAGEM: M2 (campo) + M1 (pastaBase já alimenta config-pc.ts desde o app-1.3c-i) + M3 (fundir 3 pedidos de administrador). Reaproveitar: boas-vindas.ts:22 (executor elevado), :59 pastaPermitida, config-pc.ts, entrada-no-grupo.ts, molde da área em ui/configuracoes.ts. NÃO escrever: novo caminho de elevação; nova validação de pasta (usar pastaPermitida). Risco alto (UAC e túnel; pasta alimenta backup/troca do mundo: trocar a pasta NUNCA apaga nem move o mundo antigo, só avisa onde ele ficou). Estimativas passadas estouraram 4x: fique no corte.

## Item (texto de docs/roadmap-app-melhoria.md 1.13)
Campo em Configurações › Geral "Pasta do SabreHosting" para ver/trocar a pasta-base gravada pelo assistente; trocar atualiza onde servidor e mundos são lidos (reinício do app ou recarga controlada, sem servidor rodando: se o servidor está rodando, recusa com mensagem fixa). Fundir os 3 pedidos de administrador (instala provisório, desinstala, instala definitiva) em UMA chamada do executor elevado ([P]: UAC no Windows). Erros na tela só com mensagem fixa (S-14); pasta lida do disco validada (S-07).
Arquivos: apps/desktop/src/main/boas-vindas.ts, entrada-no-grupo.ts, config-pc.ts se preciso, apps/desktop/src/ui/.
Tela no app: Configurações › Geral › "Pasta do SabreHosting".

## Critério de pronto
- [ ] Plano em docs/agentes/planos/appmel-1.13.md como primeiro commit
- [ ] Testes: trocar a pasta atualiza onde servidor e mundos são lidos; 1 só chamada do executor elevado; pasta torta recusada; servidor rodando recusa
- [ ] npm run vistoria APROVADA; PR com Tela no app:, Regressão: e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; [P] UAC no Windows
## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real.
## O que NÃO decidir
Mover/copiar mundo existente para a pasta nova (só avisar; mover é decisão do Eliel); dúvida vai à orquestradora (session_012qrjnu4Sy5GTmvMBgcHhXA).
