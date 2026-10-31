# Plano app-1.3a — Parser do convite + cofre real (corte 1/3 do app-1.3)

Método: M7 (parser puro) + M6 (`safeStorage` do Electron). Risco ALTO (segredo). Sem mundo, sem nuvem real, sem token real.

1. `packages/nucleo/src/rede/convite.ts` (puro): `lerConvite(texto, agora)` lê `sabre://convite/1.<base64url>`, confere formato,
   tamanho, campos (`g h k i p c a e`) e prazo ANTES de tudo. Devolve `{ok:true, convite}` ou `{ok:false, motivo, mensagem}`
   em pt-BR. Mensagens nunca repetem o texto, o código nem a chave. `chaveValida` do wireguard passa a ser exportada (reuso).
2. `apps/desktop/src/main/cofre.ts`: `criarCofreSeguro(safeStorage, arquivo)` implementa `Cofre` (nucleo). Recusa guardar se
   `isEncryptionAvailable()` for falso (erro claro, nada gravado); grava só o cifrado, por troca atômica (temp + rename).
3. Testes primeiro (Vitest): convite vencido, torto, versão errada, campo inválido; sem cofre não guarda; segredo fora de
   erro/log. Teste de integração `tests/integracao/convite-formato.test.ts` gera o texto com `emitirConvite` real e o parser lê.

Fora: assistente/telas (app-1.3b), Criar convite/endereço (app-1.3c), cartório, principal.ts.
