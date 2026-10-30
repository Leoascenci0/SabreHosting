# Briefing host-2.3 — Nota do PC (benchmark)

BASE: 202fbe1ca375fd96958129cf742de962fee8e94f · RAMO: roadmap/host-2.3 · MODELO: sonnet · ISSUE: #13
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 e references/enxugar.md; references/desempenho.md (só CPU/tela travada); docs/arquitetura.md §3.3
TRIAGEM: M7 (nada no repo serve; só `os` e `worker_threads` nativos, sem dependência nova) · ~130 linhas (fórmula ~30,
medição ~40, decisão ~30, testes ~30) · risco médio · MIÚDO: não. NÃO ESCREVER: pacote de benchmark ou de info do
sistema; medição real dentro da fórmula; tela (é o app-2.2); cliente de upload (upload é parâmetro até haver cartório).
PASSOS: 1) `packages/nucleo/src/nota/formula.ts`: `calcularNota(medicao)` pura → inteiro 0–100, determinística, com os
pesos e as referências escritos em constantes comentadas (a fórmula documentada no próprio arquivo e num README curto
da pasta); 2) `nota/decidir.ts`: `deveMedir({ultimaMedicaoEm, agora, jogoAberto, permitirHospedar})` pura: mede no 1º
uso e a cada 7 dias, nunca com jogo aberto, nunca se o PC não pode hospedar; 3) `nota/medir.ts`: CPU de um núcleo
(laço cronometrado curto), CPU de vários núcleos (`worker_threads`, um por núcleo, mesmo laço), RAM livre
(`os.freemem()`), upload em Mbit/s como parâmetro; teto total de 15 s com cancelamento (workers terminados).
PROVA: Vitest: mesma medição → mesma nota; nota cresce com CPU/RAM/upload melhores e fica em 0–100 nos extremos;
`deveMedir` nega com jogo aberto, com < 7 dias e sem permissão; medição falsa que passa de 15 s é cortada com erro
pt-BR; medição real (curta) termina em < 15 s (diga no PR quanto levou).

## Item (texto literal do roadmap)
- [ ] **2.3 — Nota do PC (benchmark)**
  *O que fazer:* medir CPU (um núcleo e vários, teste curto), RAM livre e upload (contra o cartório, quando houver;
  até lá, parâmetro) e gerar uma nota de 0 a 100 com a fórmula documentada. Rodar no 1º uso e semanalmente, nunca com
  jogo aberto.
  *Arquivo:* `packages/nucleo/src/nota/`
  **Tela no app:** Configurações › Geral › "Permitir que meu PC hospede" (liga/desliga).
  *Confirmação:* teste: fórmula determinística dada uma medição; benchmark leva < 15 s.
  *Depende de:* base-1.1

## Decisões que valem para este item
- Arquitetura §3.3: a troca de host começa com nota do PC novo ≥ 1,3 × nota do host. A nota precisa ser estável entre
  medições do mesmo PC (diga no PR a variação observada em 3 medições seguidas aqui na nuvem).
- **Decidido pela Máxima (reversível):** este item só expõe o campo `permitirHospedar` (booleano) para as funções do
  núcleo; a tela "Configurações › Geral › Permitir que meu PC hospede" é do app-2.2. Padrão **desligado** (o amigo
  liga), coerente com a D6 proposta ("todos que ligarem a opção"); a D6 ainda é do Eliel e pode mudar o padrão.
- Medir não pode travar a tela do app: a medição roda fora da linha principal (workers) e é assíncrona.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/host-2.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois) em packages/nucleo/
- [ ] `npm run vistoria` APROVADA; teste da medição real não deixa o `npm test` lento (> 15 s no total)
- [ ] PR com as seções do modelo, `Closes #13` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
