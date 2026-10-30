# Briefing cart-1.4 — Guardar a última cópia do mundo

BASE: c465a3dc8da35d75e926d1f0748ef94bf564f086 · RAMO: roadmap/cart-1.4 · MODELO: opus (gatilho: época/fencing + armazenamento do mundo) · ISSUE: #53
SKILLS: using-superpowers, qualidade-sabre, sysdesign-resilience-failure
LEIA: qualidade-sabre §1; references/integridade.md §3, §4, §6; references/seguranca.md §2 e §5; references/desempenho.md
TRIAGEM: M1 (`versoes.ts`/trava para autorização com época; padrão `.parcial` + rename do núcleo) + M7 (`armazem.ts`) ·
~180 linhas (+~200 teste) · risco ALTO · MIÚDO: não. NÃO ESCREVER: delta por região e "servir regiões" (vai para o
sync-1.1/1.2 — registre como melhoria); abrir o tar no cartório (o pacote é opaco aqui; quem baixa confere o manifesto);
importar `packages/nucleo` no cartório. PASSOS: 1) migração **v5** (se precisar): coluna `pacote_sha256` e
`pacote_bytes` na versão, ou tabela `copias_nuvem`; 2) `services/cartorio/src/armazem.ts`: `receberPacote(versao, pc,
epoca, fluxo, {sha256, tamanho})`: só o dono da trava com a época atual pode enviar, e só para a versão MAIS NOVA que ele
mesmo registrou; grava em fluxo para `<dados>/mundo/v<N>.tar.gz.parcial` com teto de tamanho (padrão 20 GiB,
configurável) e hash em fluxo; confere sha256 e tamanho declarados; só então `rename` atômico e registra; queda/erro →
apaga o parcial e a cópia anterior fica intacta; 3) mantém as **3** últimas cópias (decidido pela Máxima, reversível),
nunca apagando a mais nova conferida; 4) rotas com token de PC: `PUT /versoes/:n/pacote` (corpo em fluxo, sem carregar
na memória; `bodyLimit` próprio) e `GET /versoes/:n/pacote` (fluxo, com `sha256` no cabeçalho).
PROVA: queda no meio do envio (fluxo cortado) → cópia anterior intacta e nenhum parcial sobrando; hash errado recusado;
época velha/sem trava recusado sem gravar nada; versão que não é a mais nova recusada; teto de tamanho; rotação mantém 3;
envio de 50 MB não cresce a memória (fluxo); download devolve exatamente os bytes.

## Item (texto literal do roadmap)
- [ ] **1.4 — Guardar a última cópia do mundo**
  *O que fazer:* receber delta/pacote da versão aceita, montar a cópia da nuvem (troca atômica), servir regiões para
  quem precisa; guardar alguns backups com rotação.
  *Arquivo:* `services/cartorio/src/armazem.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: queda no meio do envio deixa a cópia anterior intacta.
  *Depende de:* cart-1.3, bkp-1.2

## Decisões que valem para este item
- Regras de ouro 1, 3, 4 e 5. Dados do cartório fora do diretório atual (cartmel-1.3 pendente: use caminho configurável).
- **Decidido pela Máxima (reversível):** a nuvem guarda as 3 últimas cópias; pacote opaco no cartório.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/cart-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); testes pesados com prazo explícito
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #53` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
