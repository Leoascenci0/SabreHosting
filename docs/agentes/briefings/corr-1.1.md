# Briefing corr-1.1 — Testes de infra passam fora do root (CI vermelho na main)

BASE: 2eb719fe795887ca8b86bb8bf5f4c3a046bc0cba · RAMO: roadmap/corr-1.1 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #116
SKILLS: using-superpowers, qualidade-sabre, systematic-debugging
LEIA: qualidade-sabre §1; docs/memoria/solucoes.md (S-01)
TRIAGEM (feita pela orquestradora): M4 | só testes (+ ajuste mínimo de script só se o teste não tiver como fingir root) | RISCO médio (é o portão do CI) | DIAGNÓSTICO JÁ FEITO: infra/vps/instalar.sh:61 recusa sem root (`SABRE_FALSO_UID:-$(id -u)`); o ajudante rodar() de tests/infra/instalar.test.ts:28-31 não passa SABRE_FALSO_UID=0. Com SABRE_FALSO_UID: "0" no rodar(), instalar.test.ts passa como usuário comum (conferido). Ainda falham como usuário comum: tests/infra/instalar-limbo.test.ts (11) e instalar-velocity.test.ts (23) — achar a causa (mesma recusa de root nos scripts infra/vps/limbo/ e infra/vps/velocity/, ou outra) | COMO REPRODUZIR: `useradd -m teste` (o contêiner roda como root), copiar o repositório para uma pasta do teste e `su teste -s /bin/bash -c "cd <pasta> && HOME=<pasta> npx vitest run tests/infra"` | NÃO ESCREVER: afrouxar a checagem de root dos scripts em produção; skip silencioso; mudar o que os testes provam | PASSOS: 1. reproduzir como usuário comum (falha) e como root (passa); 2. ajudantes de teste passam o "finge root" que o script já aceita; se um script não tiver esse gancho, acrescentar o mesmo padrão SABRE_FALSO_UID (só em simulação) com teste; 3. teste que precisa de root de verdade (ex.: iptables-restore, visudo) fica `skipIf(!root)` explícito, com o motivo; 4. explicar no PR por que alguns pushes da main passaram | PROVA: tests/infra verde como usuário comum e como root (cole as duas saídas no PR); vistoria APROVADA.

## Item (texto literal do roadmap; está no ramo da orquestradora)
- [ ] **1.1 — Testes de infra passam fora do root (CI vermelho na main)**
  *O que fazer:* desde ~31/10 o check "Vistoria" da `main` fica vermelho no GitHub (usuário comum) e verde na sessão
  (root): `tests/infra/instalar.test.ts` (24), `instalar-limbo.test.ts` (11) e `instalar-velocity.test.ts` (23) rodam os
  scripts em simulação sem fingir root, e o script recusa ("rode como administrador"). Fazer os ajudantes de teste
  passarem `SABRE_FALSO_UID=0` (ou o equivalente que o script já aceita) e conferir que nenhum teste depende de ser
  root sem dizer (os que precisam de root de verdade ficam como `skip` explícito fora do root). Entender por que alguns
  pushes passaram.
  *Arquivo:* `tests/infra/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npx vitest run tests/infra` verde como usuário comum (não root) e como root; check da `main` verde.
  *Depende de:* nada

## Decisões que valem para este item
- Testar daqui, nunca esperar o CI (regra do Eliel); CI vermelho depois do merge vira correção imediata.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/corr-1.1.md como primeiro commit
- [ ] Prova: tests/infra verde como usuário comum e como root
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #116) com as seções do modelo, a linha `Regressão:` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; ficha nova para docs/memoria/solucoes.md descrita na seção "Soluções" do PR

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), máquina da nuvem real, segredo. Atenção: o item redemel-1.1 roda em paralelo e mexe em infra/vps/wg/ e
tests/infra/ (wg): evite mexer nos testes do wg se não falharem.

## O que NÃO decidir (perguntar à orquestradora)
nada
