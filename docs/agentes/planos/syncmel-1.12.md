# Plano syncmel-1.12 — sobras do servir/espalhar (onda 26)

Método: M4 (a, b, d, e) + M7 pequeno (f) + teste (c). Sem decisão do Eliel.

- (a) `religarAteLigar(servidor, ms)` em `servir-arquivos.ts` devolve `parar()`; `principal.ts` guarda o parar e
  `sairDoApp` chama antes de `fechar()` e zera `servidorArquivosApp`. Teste (c) do relógio de 60 s com timers falsos.
- (b) Sem mudar código: teste que fixa "rede antes do 1º rename, nenhuma entre os renames" (aplicar.ts). A baixa
  (`exigirForaDoHost` em espalhar.ts) continua indo à rede (regra 1).
- (d) Dica da banda em `ui/index.html`: trocar "Vale na próxima atualização" por texto que diz que vale já no
  próximo arquivo baixado (o limite é lido a cada arquivo).
- (e) `baixar.ts`: guardar o handle do `setTimeout` do freio e `clearTimeout` no `destroy` do Transform. Teste: abortar
  com freio longo não deixa timer vivo.
- (f) `vitrine.fechar()` espera `andamento` por no máximo 3 s (`prazoFecharMs`); a pasta `v-*` que sobrar é limpa
  no arranque (já existe). Teste com timers falsos e publicação que nunca termina.

Tela no app: Configurações › Backups › Limite de banda (só o texto da dica). Segredo: nenhum.
