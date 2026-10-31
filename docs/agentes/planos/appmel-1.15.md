# Plano appmel-1.15 — Criar convite: anúncio para leitor de tela e nome duplicado

Método: M1 (reaproveitar). Tela no app: Configurações › Grupo › "Criar convite".

1. `src/ui/nome-na-rede.ts` passa a ser o único normalizador (o renderer não resolve pacotes soltos, mas já
   importa módulos vizinhos como `rotulo-versao.js`; o main importa de `../ui/`, como já faz com tipos).
   Teste primeiro: acento, símbolos, 32 caracteres, vazio, hífens nas pontas.
2. `main/grupo.ts` importa e reexporta; `ui/configuracoes.ts` apaga `nomeComoFica` e usa o mesmo módulo.
3. `index.html`: `<p role="status" id="convite-copiado">` junto de `#convite-copiar`; escrever "Copiado" ali
   (e manter o rótulo do botão), limpar ao criar outro convite ou sair.
4. e2e confere o texto no status. Regex do cartório e cartório: sem mudança ("vale uma vez" já conferido em
   `services/cartorio/src/convite.test.ts:601`).
