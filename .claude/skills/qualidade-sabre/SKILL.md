---
name: qualidade-sabre
description: Checklist de qualidade do SabreHosting, obrigatório em toda tarefa de código e toda revisão. Junta integridade do mundo (backup, trava de host, sync, migração), segurança (rede, cartório, segredos, downloads), desempenho (RAM, CPU, transferência), interface do app e enxugar. Diz qual parte detalhada ler para o tipo da mudança. Use antes de escrever código, ao revisar PR e ao montar briefing.
---

# Qualidade do SabreHosting

Equivalente à `qualidade-segi` do SEURBH, adaptada a um app desktop que mexe no mundo de Minecraft dos amigos.
O `CLAUDE.md` vence esta skill.

## 1. Checklist comum (todo código, toda revisão)

1. **O mundo nunca corre risco:** as 6 regras de ouro do `CLAUDE.md` valem; na dúvida, leia `references/integridade.md`.
2. **Nenhum segredo no repositório:** token, chave WireGuard, senha, endereço privado. Vêm de variável de ambiente ou
   do armazenamento seguro do sistema (Windows Credential Manager via `keytar`/`safeStorage`); `.env.exemplo` documenta.
3. **Nada exposto à internet no PC de um amigo:** o PC só fala para fora pela rede privada; nenhuma porta aberta no
   roteador, nenhum UPnP.
4. **Todo download confere hash** (jar do servidor, Java, plugin, pacote do mundo) antes de usar.
5. **Erro tratado com mensagem em pt-BR** que diz ao amigo o que fazer ("O PC do Lucas saiu; o servidor está
   voltando no seu em 20 s"), e registro técnico no log.
6. **Teste com mundo inventado** (`tests/mundos/`); teste novo para todo comportamento novo.
7. **Configurável pelo app:** valor que um amigo precisaria mudar vai para Configurações, não fica fixo no código.
8. **Sem dependência nova** sem linha em `docs/ops/DECISOES.md` (o que é, por que, licença).

## 2. Qual parte ler

| Mudança | Leia |
|---|---|
| backup, restaurar, sync, trava, versão, migração de host, pasta do mundo | `references/integridade.md` |
| rede, cartório, proxy, convite de amigo, download, segredo, atualização do app | `references/seguranca.md` |
| servidor Java, RAM/CPU, transferência, compactação, tempo de troca | `references/desempenho.md` |
| tela, janela, bandeja, notificação, texto | `references/interface.md` |
| qualquer código ou revisão | `references/enxugar.md` |

## 3. Linhas obrigatórias no relatório e no PR

```
Segurança: <o que foi conferido; "sem superfície nova" se for o caso>
Integridade: <regras de ouro tocadas e como foram provadas; "não toca o mundo">
Enxugamento: <linhas ±, o que foi reaproveitado, invariantes intactos>
```
