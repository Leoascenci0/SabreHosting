# Briefing lanc-1.1 — Achar o Prism no PC

BASE: 488075c91af957e4e05d174a673253fd878d34cf · RAMO: roadmap/lanc-1.1 · MODELO: sonnet · ISSUE: #35
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/seguranca.md §3 (execução); cabeçalho de docs/roadmap-lanc.md (regra GPL)
TRIAGEM: M7 (nada existe) · ~120 linhas (+~110 teste) · risco médio · MIÚDO: não. NÃO ESCREVER: dependência de INI/Qt
ou leitor de executável; executar o Prism; **nenhum código nem trecho do Prism (GPL-3.0)** — só comportamento e formatos
documentados. PASSOS: 1) `packages/nucleo/src/launcher/prism.ts`: `detectarPrism({ambiente, fs, lerRegistro?,
pastaEscolhida?})` com tudo injetado; ordem: pasta escolhida pelo amigo → instalação padrão
(`%LOCALAPPDATA%\Programs\PrismLauncher`) → portátil (`prismlauncher.cfg` ao lado de `prismlauncher.exe`) → dados em
`%APPDATA%\PrismLauncher`; 2) ler `InstanceDir` do `prismlauncher.cfg` (texto `chave=valor`, seção `[General]`;
relativo à pasta de dados; tratar aspas e barras), padrão `instances`; 3) versão: `lerRegistro` injetado que, no
Windows, roda `reg query` das chaves de desinstalação via `execFile` **sem shell** e lê `DisplayVersion` do
PrismLauncher; portátil ou sem registro → `versao: null` (aceito, com aviso); 4) retorno `{instalado: true, pasta,
pastaInstancias, versao, avisos}` ou `{instalado: false, linkDownload: "https://prismlauncher.org/download"}`;
`versao` abaixo da mínima → `{instalado: true, antigo: true, ...}` com mensagem pt-BR.
PROVA: pastas falsas temporárias + ambiente injetado: instalado padrão, portátil, InstanceDir personalizado (absoluto e
relativo), ausente (link), versão antiga, registro sem a chave; nenhum teste chama o `reg` de verdade.

## Item (texto literal do roadmap)
- [ ] **1.1 — Achar o Prism no PC**
  *O que fazer:* detectar se o Prism está instalado (caminhos padrão no Windows e o escolhido pelo amigo), qual versão
  e onde fica a pasta de instâncias; sem Prism, mostrar o link oficial de download.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`
  **Tela no app:** Configurações › Geral › "Pasta do Prism" (automático por padrão).
  *Confirmação:* testes com pastas falsas (instalado, ausente, versão antiga demais).
  *Depende de:* base-1.1

## Decisões que valem para este item
- CLAUDE.md › Launcher: integrar ao Prism; nunca copiar código GPL; conta só Microsoft.
- **Decidido pela Máxima (reversível):** versão mínima do Prism = **8.0**; versão desconhecida (portátil) é aceita com
  aviso. Campo "Configurações › Geral › Pasta do Prism" entra como parâmetro `pastaEscolhida` (tela no app-2.2).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lanc-1.1.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #35` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
