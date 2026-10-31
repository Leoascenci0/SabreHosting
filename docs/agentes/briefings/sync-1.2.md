# Briefing sync-1.2 — Aplicar delta com troca atômica

BASE: ae178b897fb09a9e6761d2a6b8e36cc877576be7 · RAMO: roadmap/sync-1.2 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §integridade §3; §desempenho; sysdesign-resilience-failure; §seguranca (caminho vindo de manifesto)
TRIAGEM: M1+M7 (+M3 no aviso ao cartório) ~180 linhas + ~280 de teste, risco alto (sync/troca do mundo: duas lentes). Reaproveitar backup/manifesto.ts (compararManifestos ~:206, validarManifesto ~:127, gerarManifesto), sync/transferencia.ts (pedirArquivo ~:155, que já retoma e confere hash), servidor/baixar.ts baixarConferido, integridade/hash.ts, backup/pacote.ts abrirPacote (~:296), backup/restaurar.ts (PADRÃO de troca: temporária irmã, mundo→.antigo, temporária→mundo, desfazer, MARCADOR_RESTAURACAO — copie o padrão, não invente outro), servidor/processo.ts travaConfirmada, cartorio/cliente.ts. PASSOS: diferenca=compararManifestos(N,M); temporária irmã do mundo (ex. <mundo>.atualizando-<versão>); arquivos iguais por hard link com cópia de fallback; novos/mudados por pedirArquivo com o sha256 de M; apagados saem da temporária; gerarManifesto(temporária) tem que bater com M INTEIRO; só com trava confirmada e servidor parado: mundo→.antigo, temporária→mundo; só depois o aviso ao cartório; .antigo apagado só no fim. ARMADILHAS: (a) com hard link NUNCA abrir/escrever/truncar arquivo linkado (corrompe N): 'mudado' = gravar arquivo NOVO (desfazer o link); (b) queda entre os dois renames precisa do mesmo tratamento de restaurar.ts; (c) reconferir o hash dos arquivos iguais; (d) caminho sempre do manifesto validado (sem path traversal; nota do qa de segurança do sync-1.1: arquivos() nunca devolve link simbólico para fora); (e) falha no aviso ao cartório NÃO desfaz a troca; (f) fs.link pode falhar entre discos/Windows: fallback para cópia, nunca escrita sobre N. Não escrever: comparação/validação/hash de manifesto, download/retomada, outra rotina de troca de pasta.

## Item (texto literal do roadmap)
- [ ] **1.2 — Aplicar delta com troca atômica**
  *O que fazer:* da versão local N para a versão M: copiar N para temporária (hard link quando der), aplicar os arquivos que mudaram, conferir o manifesto de M inteiro, `rename`; informar o cartório.
  *Arquivo:* `packages/nucleo/src/sync/aplicar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: queda em qualquer ponto deixa N intacto; bytes transferidos = só as regiões mudadas.
  *Depende de:* sync-1.1, cart-1.3

## Decisões que valem para este item
Regras de ouro 2, 3 e 5 do CLAUDE.md. Decidido pela Máxima (reversível): o manifesto de N vem do manifesto.json do pacote fechado se existir; senão gera-se com gerarManifesto numa pasta parada. 'Informar o cartório' = função injetada `avisarCopia(versao)`; confira em services/cartorio e cartorio/cliente.ts a rota da tabela `copias` (cart-1.3): se o cliente não tiver método, acrescente o mínimo em cliente.ts (arquivo permitido para este item) com teste; não mude o cartório.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/sync-1.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Mudar o formato do pacote/manifesto; ligar o sync ao app (sync-2.1); mexer no serviço do cartório.
