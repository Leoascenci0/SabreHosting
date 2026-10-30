# Plano rede-1.3 — Rede privada: hub e convite de PC

Issue #55 · ramo `roadmap/rede-1.3` · método M3 (molde `instalar.sh`) + M7 · risco ALTO (rede privada, chaves).

## Desenho
**Hub** — `infra/vps/wg/adicionar-pc.sh adicionar <nome> <chave-publica>` / `remover <nome>`:
- Só recebe chave PÚBLICA (44 caracteres, base64 de 32 bytes). A privada nasce no PC e nunca chega ao hub.
- IP: o menor livre em 10.66.0.2–254; registro `pcs.tsv` (modo 600) guarda `nome ip chave estado`; PC removido fica
  como "removido" e seu IP **nunca é reaproveitado**. Trava `flock` contra duas execuções ao mesmo tempo.
- Ordem (cada passo idempotente, então uma queda no meio se conserta rodando de novo): registro → `wg0.conf`
  (arquivo novo + `mv`, modo 600; `AllowedIPs` sempre `<ip>/32`, conferido antes do `mv`) → `wg set`.
- Devolve o "pacote de ligação" em JSON: IP do PC, chave pública e endpoint do hub, `AllowedIPs` do lado do PC
  `10.66.0.0/24` (nunca `0.0.0.0/0`). `SABRE_SIMULAR=1` não muda a máquina (estado em `SABRE_ESTADO`).
- Mesmo nome + mesma chave = devolve o mesmo pacote; mesmo nome + outra chave, ou mesma chave + outro nome = recusa.

**PC** — `packages/nucleo/src/rede/wireguard.ts`:
- `gerarChavesDoPc()`: X25519 do Node (`node:crypto`), com clamp igual ao `wg genkey`. Escolha: não depende do
  `wg.exe` instalado antes do convite e a chave privada não passa por processo filho nem pipe.
- `validarPacote` + `montarConfigDoPc(pacote, chavePrivada)` PURA: recusa qualquer campo fora do formato (injeção de
  linha na config); sem `DNS`, sem `0.0.0.0/0`, `PersistentKeepalive = 25`.
- `aplicarNoWindows(cfg, op)`: pasta do app protegida (`icacls`, só usuário/SYSTEM/Administradores) → grava `.conf`
  (0600) → `wireguard.exe /installtunnelservice` com administrador (executor injetado; padrão: `powershell
  Start-Process -Verb RunAs`, caminhos por variável de ambiente, nunca montados na linha de comando) → apaga o `.conf`
  em texto (o WireGuard guarda a sua cópia protegida). Nada vai para log; erros nunca citam a chave.
- `testarLigacao()`: `ping` a 10.66.0.1 com prazo; sucesso só com `TTL=` na saída (o Windows devolve 0 mesmo em
  "host inacessível").

## Testes (vermelhos primeiro)
`tests/infra/adicionar-pc.test.ts` (simulação): dois PCs → IPs diferentes; chave inválida recusada; re-adicionar é
idempotente; `AllowedIPs` /32 no hub e /24 no PC; remover não devolve o IP; nome/endpoint inválidos.
`wireguard.test.ts`: vetor RFC 7748 para a derivação; config sem `0.0.0.0/0`/DNS; chave privada fora de log e de
erro; executor com argumentos fixos e `shell: false`; ping.

## Fora do escopo (vira melhoria)
Rota do cartório que valida o convite (a entrada é o convite já validado); tela (app-2.2); desligar/reaplicar túnel;
acesso à máquina real. Teste com 2 "PCs" em namespaces: só se houver `wg`/`ip` na sessão (não há; será dito no PR).
