# Briefing rede-1.3 — Rede privada: hub e convite de PC

BASE: bcae112b3c9196b86773e5a47ade862ed7f313c4 · RAMO: roadmap/rede-1.3 · MODELO: sonnet (esforço alto; revisão de segurança) · ISSUE: #55
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §1, §2, §3, §4; `infra/vps/instalar.sh` (wg0 10.66.0.1/24, chave do hub)
TRIAGEM: M3 (molde do `instalar.sh`: `SABRE_SIMULAR`/`executar`; `execFile` sem shell como no `prism.ts`) + M7 ·
~200 linhas (+~200 teste) · risco ALTO · MIÚDO: não. NÃO ESCREVER: chave privada de PC gerada fora do PC (a chave
privada nasce no PC; o hub só recebe a pública); a parte do cartório que valida o convite (use o convite já validado
como entrada; a rota fica para depois — registre como melhoria); tela (app-2.2); acesso a máquina real.
PASSOS: 1) `infra/vps/wg/adicionar-pc.sh` (no hub, idempotente, modo simulação): recebe nome do PC + chave PÚBLICA
(validada: base64 de 32 bytes), escolhe o próximo IP livre em 10.66.0.2–254 (nunca repete; registro em arquivo 600),
acrescenta `[Peer]` com `AllowedIPs = <ip>/32` (nunca mais que /32) via `wg set` + persistência atômica do wg0.conf,
devolve o "pacote de ligação" (IP do PC, chave pública e endpoint do hub, `AllowedIPs` do lado do PC = 10.66.0.0/24 —
nunca 0.0.0.0/0, para não sequestrar a internet do amigo); remover PC também; 2) `packages/nucleo/src/rede/wireguard.ts`:
`gerarChavesDoPc()` (no PC; via `wg genkey`/`wg pubkey` do WireGuard para Windows com `execFile` sem shell, ou crypto
X25519 do Node se equivalente — justifique), `montarConfigDoPc(pacote, chavePrivada)` PURA (sem `DNS`, sem
`0.0.0.0/0`, `PersistentKeepalive = 25`), `aplicarNoWindows(cfg)`: grava em pasta do app com permissão restrita e
chama `wireguard.exe /installtunnelservice <arquivo>` (precisa de administrador uma vez — injete o executor; nenhum
teste roda o real), `testarLigacao()` (alcançar 10.66.0.1 com prazo).
PROVA: hub em simulação: dois PCs recebem IPs diferentes; chave pública inválida recusada; re-adicionar o mesmo PC é
idempotente; AllowedIPs sempre /32 no hub e 10.66.0.0/24 no PC; config do PC nunca contém 0.0.0.0/0 nem chave do hub
privada; chave privada do PC nunca em log; executor do Windows chamado com argumentos fixos e sem shell. Se houver
`wg` e namespaces de rede na sessão, o teste com 2 "PCs" em namespaces; senão, diga que não rodou.

## Item (texto literal do roadmap)
- [ ] **1.3 — Rede privada: hub e convite de PC**
  *O que fazer:* no hub, gerar a configuração WireGuard de um PC novo a partir de um convite; no núcleo, módulo que
  aplica a configuração no Windows (pede permissão de administrador uma vez) e testa a ligação.
  *Arquivo:* `infra/vps/wg/`, `packages/nucleo/src/rede/wireguard.ts`
  **Tela no app:** Configurações › Grupo › "Entrar com convite".
  *Confirmação:* teste em contêineres: dois "PCs" falam entre si só pela rede privada. **[P: prova real no PC]**
  *Depende de:* rede-1.1

## Decisões que valem para este item
- D2 WireGuard próprio, hub na nuvem, rede 10.66.0.0/24; nenhuma porta aberta em casa.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/rede-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #55` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
