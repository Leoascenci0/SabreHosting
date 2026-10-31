# Plano drive-1.1b — Rotação na pasta sincronizada

Triagem: M1+M2 (reaproveitar `rotacionarPasta`, `marcarBackup`, `criarRotacaoBackups`, `copiarAoConcluir`).
Regra: 10 mais novos + tudo dos últimos 7 dias; nunca apaga o último bom (já em `planejarRotacao`).

1. **Corrigir antes de ligar** (teste que falha antes)
   - `rotacao.ts`: `conferirPacoteDetalhado` devolve `ok | ruim | indisponivel`. Só vira `ruim` quando o hash ou o
     manifesto não bate (`PacoteRecusado`); falha de leitura (Drive baixando, disco cheio) é `indisponivel` e fica
     sem marca. `conferirPacote` continua booleano (ok = true).
   - `rotacao-pasta.ts`: `conferirEMarcar` só marca `ruim` no veredito `ruim`.
   - `preferencias.ts`: `quantosGuardar` só aceita `typeof === "number"` (true, "5", [3] voltam ao padrão).
2. **Ligar na pasta do histórico**
   - `marcarBackup`/`rotacionarPasta` ganham `arquivoMarcas` opcional: as marcas do histórico ficam na pasta de dados
     do app, nunca na pasta sincronizada (dois PCs não disputam o arquivo).
   - `copiarAoConcluir` ganha `aoCopiar`: chamado SÓ depois de `copiarParaPasta` conferir o hash; marca `bom` e roda a
     rotação da pasta do histórico (instância própria de `criarRotacaoBackups`). Erro vira aviso, nunca derruba o
     backup local nem apaga nada.
3. **Tela:** Configurações › Backups › "Quantos guardar nesta pasta" (padrão 10, validado como o outro) + aviso de uma
   frase: apagar na pasta também apaga na nuvem do serviço.
4. **Provas (mundo inventado):** pasta some no meio; não apaga o que não é do Sabre; último bom sobrevive; campo com 0
   recusado; I/O falho não marca ruim; duas rotações juntas pulam (já coberto, repetido para a 2ª instância).
