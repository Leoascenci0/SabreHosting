# Plano lanc-1.3 — Botão Jogar abre o jogo já conectado

Triagem: M1 (+M7), ~120 linhas com teste.

1. `packages/nucleo/src/launcher/abrir.ts` (novo): `abrirJogo({ pasta, idInstancia, endereco, pastaMarcador, exec?, existeMarcador? })`.
   - Valida o endereço (`host:porta`, só letras/números/ponto/hífen) e o id da instância (sem separador de caminho) ANTES da linha de comando.
   - Só abre se a pasta do grupo tem o marcador do SabreHosting (`temMarcadorSabre`); nunca outra instância do amigo.
   - Chama `prismlauncher.exe --launch <id> --server <endereco>` (opções documentadas do Prism) por `execFile` sem shell, argumentos em lista. Prism já aberto: a própria CLI entrega o pedido à janela em uso.
   - Reaproveita `ExecArquivo` de prism.ts. Falha vira mensagem em pt-BR.
2. `apps/desktop/src/main/inicio.ts`: dep opcional `abrirJogo?(endereco)`; `jogar()` copia o endereço (como hoje) e tenta abrir; devolve `aberto`.
3. Tela: o botão Jogar mostra "Abrindo…" e a mensagem de sucesso/falha.
4. Fora: `SABRE_ENDERECO`/deps-reais (app-1.3c).
5. Testes: executável falso confere argumentos; recusas (endereço ruim, id com `..`, sem marcador); `jogar` com e sem abrir.
P: conferir no PC com Prism real.
