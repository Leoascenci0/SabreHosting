# Triagem: escolher o método antes de escrever (parte da skill `maxima`)

Adaptada do SEURBH (Eliel, 29/10/2026). Escrever e depois reescrever paga o código duas vezes; a economia vem
**antes**. Ao montar o briefing de item de código, a Máxima chama o agente `triagem` (Haiku). Ele vê o que já existe e
escolhe o primeiro método que serve, com estimativa de linhas e o que não escrever. A filha segue e escreve uma vez.

## Os métodos (do mais curto ao mais longo; escolher o primeiro que serve)

| Método | Quando | Como | Faixa típica | Prova |
|---|---|---|---|---|
| **M1 Reaproveitar** | já existe função ou módulo que faz quase isso | chamar o existente; no máximo um parâmetro novo | 5–30 linhas | teste do existente + o caso novo |
| **M2 Dado, não código** | o pedido é opção, limite, texto ou regra que muda | campo em `configuracoes` lido pelo código existente, editável na tela de Configurações | 0–40 linhas | a tela mostra e edita o valor |
| **M3 Estender o vizinho** | há módulo irmão (ex.: outro tipo de transferência) | copiar o molde mudando só o que difere; 2 cópias iguais → uma função com parâmetro | 20–80 linhas | os testes do vizinho continuam passando |
| **M4 Correção pontual** | bug | `systematic-debugging`; menor diff; teste que falhava antes | 1–30 linhas | teste novo falha sem o conserto |
| **M5 Tela pelo molde** | tela ou janela nova no app | componentes prontos de `apps/desktop/src/ui/` (`qualidade-sabre › interface`) | 60–200 linhas | checklist da `interface` |
| **M6 Biblioteca pronta** | problema resolvido por pacote conhecido e mantido (zip, hash, RCON) | usar o pacote (dependência nova pede linha em DECISOES); só a cola | 20–100 linhas | teste da cola |
| **M7 Código novo** | nada acima serve (trava, delta de regiões, migração de host) | `test-driven-development`, o menor caminho; dizer por que M1–M6 não servem | estimativa pelo Histórico | o teste escrito antes |

Os invariantes valem para todos (`qualidade-sabre › enxugar`): o método escolhe o caminho curto, nunca tira hash,
trava, confirmação, validação ou backup-antes-de-restaurar.

## Risco: revisão do tamanho do item

| Risco | Quando (qualquer um) | Revisão |
|---|---|---|
| **alto** | trava, migração de host, sync, restaurar/apagar backup, rede, cartório, segredo; diff > 300 linhas | duas lentes (`qa` integridade + `qa` segurança) e síntese |
| **médio** | tela nova; M5, M6 ou M7; diff de 31 a 300 linhas | agente `qa` (Sonnet) |
| **baixo** | M1, M2 ou M4 com ≤ 30 linhas; texto, documento | agente `qa` com `model: "haiku"` |

A Máxima confere o risco no diff real; risco nunca desce na revisão.

## O banco (`docs/memoria/metodos-aprendidos.md`)

- **Histórico:** uma linha por item mergeado: item · tipo · método · estimado · real · trocou? · PR.
- **Lições (L-NN):** método que falhou para um tipo de demanda, com Vezes. Vezes ≥ 3 vira linha na tabela acima.
- **Anti-padrões (A-NN):** o que parece encurtar e quebra; a triagem nunca indica.
- A filha não edita o banco: o PR traz `Triagem: M<n> estimado ~e, real r`; a Máxima grava no merge.

## Lote de miúdos

Itens `MIÚDO: sim` (≤ 30 linhas, risco baixo, mesmo módulo ou documento) vão 2–3 por filha Haiku, um commit por
item, um PR, linha `Triagem:` de cada um.

## Leitura cirúrgica (LEIA:)

O briefing diz que seção de cada skill ler (`LEIA: qualidade-sabre §1; integridade §2`). A filha lê só aquilo
(`grep -n '^## '` + `sed -n`), não a skill inteira.

## Nunca

- Triagem que escreve código ou edita arquivo.
- M7 sem dizer por que M1–M6 não servem.
- Estimativa inventada sem Histórico nem faixa.
