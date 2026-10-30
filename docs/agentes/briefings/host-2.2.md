# Briefing host-2.2 — Comandos ao servidor: salvar com segurança, avisar no chat

BASE: 97a027bd775bae1367eb873eeda3266cbaae4ce7 · RAMO: roadmap/host-2.2 · MODELO: sonnet (esforço alto; revisão com duas lentes) · ISSUE: #28
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §2 (backup consistente); references/seguranca.md §5
TRIAGEM: M7 + M1 (evento "log" e stdin de `ServidorMinecraft` em processo.ts) · ~170 linhas (+~130 teste) · risco ALTO
("salvar" libera a cópia do mundo) · MIÚDO: não. NÃO ESCREVER: cliente RCON, senha, porta, `enable-rcon`; leitor de
linhas novo; "handle" de save-on que o chamador precisa lembrar de soltar. PASSOS: 1) processo.ts: um único método
público `enviar(linha)` que recusa `\r`, `\n` e controle, e só escreve em "pronto"; 2) `comandos.ts`: fila (um comando
por vez); cada comando registra o ouvinte de "log" ANTES de escrever e casa a resposta com prazo; 3) `say(texto)`: sem
quebra de linha nem controle, até 256 caracteres; 4) `list()`: regex ancorada no fim do prefixo do NeoForge (`]: `) →
{online, maximo, nomes}; 5) `salvarSeguro(servidor, copiar)`: `save-off` → `save-all flush` (prazo padrão 120 s)
casando `/\]: Saved the game\s*$/` → `await copiar()` → `save-on` num `finally` (também no prazo estourado e na falha
da cópia); se o servidor não estiver pronto, recusa sem mandar nada.
PROVA: com o servidor falso (novos modos): `salvarSeguro` só chama `copiar` depois de "Saved the game"; `save-on` vai
mesmo se `copiar` lança ou o prazo estoura; jogador escrevendo "<Nick> Saved the game" no chat NÃO libera a cópia;
`say` com \n é recusado e o falso não recebe linha extra; comandos concorrentes saem em ordem; `list` com 0 e 2
jogadores.

## Item (texto literal do roadmap)
- [ ] **2.2 — Console/RCON: salvar, pausar gravação, avisar no chat**
  *O que fazer:* cliente RCON (ou console via stdin) com `save-off`, `save-all flush` (esperando a confirmação),
  `save-on`, `say`, `list`. Senha RCON gerada por sessão, nunca gravada no git.
  *Arquivo:* `packages/nucleo/src/servidor/comandos.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: `salvarSeguro()` só devolve depois do "Saved the game" do servidor falso.
  *Depende de:* host-2.1

## Decisões que valem para este item
- **Decidido pela Máxima (segurança, reversível):** comandos pelo **console do processo** (stdin/stdout), não RCON: sem
  porta de rede nem senha. O texto do roadmap fala em "senha RCON gerada por sessão": não se aplica com o console.
- Regra de ouro 2: nunca copiar com o servidor gravando; o `save-on` volta sempre.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/host-2.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); testes de processo.ts continuam verdes
- [ ] `npm run vistoria` APROVADA; nenhum processo órfão
- [ ] PR com as seções do modelo, `Closes #28` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
