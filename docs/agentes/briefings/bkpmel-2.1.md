# Briefing bkpmel-2.1 — Restauração: atalho no lugar do mundo e marcador garantido

BASE: 50f0b63dfbc566cd1d208d29293e80903669d175 · RAMO: roadmap/bkpmel-2.1 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #83
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade §4 (rotação e restauração) e §6 (como provar); maxima/references/triagem.md seção M4
TRIAGEM: M4 (correção pontual, duas correções no mesmo arquivo) | ~35 linhas de código + ~60 de teste | RISCO alto (restaurar) | MIÚDO: não | REAPROVEITAR: restaurarBackup e desfazer() em packages/nucleo/src/backup/restaurar.ts:75 e :146; MARCADOR_RESTAURACAO em packages/nucleo/src/servidor/configurar.ts:80; helpers sobras/cenario/gerarMundo em restaurar.test.ts:45-80 e test/ajuda/mundos.js; padrão lstat em backup/manifesto.ts:81 | NÃO ESCREVER: lista de link simbólico nova; novo tipo de marcador ou log (reusar RESTAURACAO-INCOMPLETA.txt); mexer em rotacao.ts, configurar.ts, processo.ts; nada em services/cartorio, packages/nucleo/src/cartorio, infra/vps/wg (outros itens da onda) | PASSOS: 1. haMundo: stat → lstat; link simbólico ou não-pasta é recusado com "não é uma pasta; nada foi alterado". 2. desfazer: no catch do writeFile do marcador, em vez de engolir o erro, incluir no erro final (pt-BR, com caminho) que o marcador não foi gravado. 3. Testes: link quebrado e link para pasta recusados sem tocar no mundo; marcador bloqueado (pasta com o nome RESTAURACAO-INCOMPLETA.txt) → erro diz que o marcador falhou e os caminhos. | PROVA: os dois testes novos falham antes e passam depois; hashesDoMundo igual ao de antes e sobras vazias.

## Item (texto literal do roadmap)
- [ ] **2.1 — Restauração: atalho no lugar do mundo e marcador garantido**
  *O que fazer:* `haMundo` com `lstat` (um link quebrado no lugar da pasta do mundo é recusado, não tratado como
  "inexistente"); se gravar o `RESTAURACAO-INCOMPLETA.txt` falhar, avisar em pt-BR em vez de engolir o erro.
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: link quebrado recusado; falha ao gravar o marcador vira aviso.
  *Origem:* bkp-2.2 · PR #64 · qa

## Decisões que valem para este item
- Regras de ouro 3 e 4 do CLAUDE.md (troca atômica; nunca apagar o último backup bom; restaurar faz backup do atual antes).
- Nada aqui apaga mundo nem backup: só troca uma checagem e uma mensagem.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkpmel-2.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/src/backup/restaurar.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #83) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
nada
