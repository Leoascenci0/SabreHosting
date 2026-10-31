# Briefing piloto-1.1a — Importar mundo de .zip (núcleo seguro)

BASE: 37baba740230b19b237a2a9b87104d235ec89d45 · RAMO: roadmap/piloto-1.1a · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §seguranca (entrada não confiável, caminho), §integridade (pacote, versões), §desempenho (zip não inteiro na RAM), §enxugar
TRIAGEM: M6 (yauzl) + M1 (criarPacote) + M7 (validação), ~230 linhas + ~250 teste, risco ALTO. Corte da Máxima: este é o 1.1a (SÓ núcleo: zip seguro → pacote → versão 1). 1.1b (ler level.dat/versão do Minecraft) e 1.1c (tela "Importar mundo" + tutorial) ficam para depois.
REAPROVEITAR: nucleo/src/backup/pacote.ts:97 criarPacote e :296 abrirPacote; integridade/hash.ts; backup/manifesto.ts; a validação de caminho de bkpmel-1.1 (reusar, não reescrever); PUT /versoes/:n/pacote no cartório (services/cartorio/src/servidor.ts:477) — nucleo/src/cartorio/cliente.ts NÃO tem método de versão: confira sync/transferencia.ts antes de criar cliente novo.
NÃO ESCREVER: leitor de tar/hash próprio; extrator em memória (fflate/unzip inteiro põe o mundo na RAM); tela.
DEPENDÊNCIA NOVA AUTORIZADA (DECISOES 31/10): leitor de zip. Recomendado yauzl (MIT, JS puro, sem nativo, lê entrada a entrada) + @types/yauzl (dev), versão FIXA no lockfile (sem ^). Conferir licença e último release com npm view antes; se yauzl não servir, parar e avisar a Máxima (outra dependência exige nova linha em DECISOES). Registre a dependência em docs/ops/DECISOES? NÃO — a linha já existe; cite-a no PR.
PASSOS: (1) importar.ts recusa ANTES de gravar qualquer byte: caminho absoluto, "..", letra de unidade/UNC, nome com NUL ou barra invertida, link simbólico (bits de modo Unix nos atributos externos), entrada repetida (inclusive diferindo só em maiúsculas), total declarado e total LIDO acima do teto (bomba de zip: conte bytes no fluxo, não confie no declarado; teto configurável com padrão sensato), número de entradas acima do limite. (2) extrai para pasta temporária vazia filha direta da pasta de trabalho; confirma que cada destino resolvido fica dentro dela; (3) criarPacote → hash → envio da versão 1 com época pelo caminho existente; (4) limpa a temporária sempre (inclusive em erro). Troca atômica/hash intactos (regras 2, 3). Só mundo inventado: gere os zips de teste no próprio teste (inclusive hostis) em tests/mundos/.
PROVA: um teste por caminho hostil (zip-slip, absoluto, "..", link, bomba, duplicado), cada um falhando antes; versão 1 com hash igual ao de criarPacote; nada criado fora da pasta de destino mesmo no erro. S-07: nome vindo do zip é entrada não confiável.

## Item (texto literal do roadmap)
- [ ] **1.1 — Importar o mundo da hospedagem atual** *(⏸️ P em 31/10: precisa de biblioteca nova para ler zip — dependência nova exige aprovação do Eliel em DECISOES; envio de versão ao cartório já existe (`PUT /versoes/:n/...`); alternativa: aceitar só pasta já extraída)*
  *O que fazer:* ferramenta que importa um zip/pasta de mundo baixado da hospedagem (checa versão do Minecraft,
  plugins, tamanho), gera a versão 1 no cartório; tutorial de como baixar o mundo do painel da hospedagem.
  *Arquivo:* `packages/nucleo/src/importar.ts`, `docs/tutoriais/piloto-importar.md`
  **Tela no app:** Backups › "Importar mundo".
  *Confirmação:* importar um mundo de teste; depois o real. **[P: baixar o mundo real]**
  *Depende de:* cart-1.4, app-2.1

- [ ] **1.2 — Pré-gerar o mapa e afinar o servidor**

## Decisões que valem para este item
- 31/10 (Eliel): importar lendo o .zip direto; dependência nova de leitura de zip autorizada (pequena, muito usada, versão fixada no lockfile); o app valida cada caminho (nada fora da pasta de destino).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/piloto-1.1a.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), tela, máquina da nuvem real, mundo real dos amigos, segredos.

## O que NÃO decidir (perguntar à orquestradora)
Trocar de biblioteca de zip sem avisar; baixar o mundo real.
