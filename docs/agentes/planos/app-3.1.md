# Plano app-3.1 — instalador Windows e versão no GitHub Releases

Triagem: M1/M2 (dispensada pela onda). Só configuração e scripts validáveis na nuvem.

## O que já existe (grep)
- `vistoria.yml` (actions fixadas por hash), `.nvmrc` (22), `apps/desktop/recursos/icone/icone.ico`, teto `instalador_mb` em `scripts/limites.json`.
- Nenhum empacotador ainda.

## Passos (TDD, um commit por passo)
1. `apps/desktop/electron-builder.json`: NSIS, só Windows x64, `artifactName` fixo, `publish: null` (quem publica é o workflow), sem assinatura (D9 é do Eliel), instalação por usuário, sem elevação.
2. `apps/desktop/scripts/checksums.mjs` (+ `checksums.test.ts`): gera `SHA256SUMS.txt` (formato `hash  arquivo`) e reprova instalador acima do teto de `limites.json`.
3. `.github/workflows/versao.yml`: dispara em tag `v*.*.*`; runner `windows-latest`; confere tag = versão do `package.json`; `npm ci`, build, electron-builder, checksums; cria a release com `gh release create` (permissão `contents: write` só nesse job, sem ação de terceiros). Teste textual valida gatilho, runner, permissões, hash das actions, ausência de segredo.
4. Dependência nova `electron-builder` (MIT, devDependency do app, lockfile) com linha em `docs/ops/DECISOES.md`.

## Fora do alcance / não confirmado
Sem assinatura de código, sem tag nem release de verdade. Instalar num PC Windows: ⏸️ [P].
