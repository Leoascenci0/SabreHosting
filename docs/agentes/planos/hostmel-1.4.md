# Plano hostmel-1.4 — testes que faltam na configuração e endurecimento

Método M4 (~30 linhas). Arquivos: `packages/nucleo/src/servidor/configurar.ts` e `.test.ts`.

1. Teste: `10.999.0.1` recusado (octeto inválido). Falha se `octetosValidos` for apagado.
2. Teste + código: `enable-query=false` logo após `enable-rcon=false`.
3. Estreitar o IP aceito para PC definitivo da rede privada: 10.66.0.2 a 10.66.0.199 (hub .1 e sala de entrada 200–254 recusados), mantendo `octetosValidos`.
4. Atualizar exemplos dos testes (10.8.0.5 → 10.66.0.5); recusados novos: 10.0.0.1, 172.16.0.1, 192.168.1.9, 10.8.0.5, 10.67.0.5, 10.66.0.1, 10.66.0.200, 10.66.0.255.
5. Grep por IPs fora da faixa em app/exemplos; só relatar.

Prova: testes novos falham antes; mutação (remover `octetosValidos`) derruba teste; `npm run vistoria` APROVADA.
Assinaturas exportadas não mudam.
