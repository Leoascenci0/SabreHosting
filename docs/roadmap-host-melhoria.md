# Roadmap de melhoria — Host

Melhorias achadas durante os itens do `docs/roadmap-host.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `hostmel`.** Ramos `roadmap/hostmel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Baixar e preparar

- [ ] **1.1 — Hashes fixados por versão**
  *O que fazer:* tabela de hashes (NeoForge, Java) por versão, conferida pelo grupo, em vez de confiar só no sidecar
  `.sha1` do mesmo servidor do arquivo (protege contra servidor comprometido).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com sidecar adulterado recusado pela tabela.
  *Origem:* host-1.1 · PR #12 · filha

- [ ] **1.2 — Resolvedores mais rígidos e http local só por opção**
  *O que fazer:* resolvedores recusam URL que não seja https; regex da versão do NeoForge exige começar por dígito; a
  exceção http para localhost em `baixarConferido` vira opção injetada `permitirHttpLocal` (padrão falso).
  *Arquivo:* `packages/nucleo/src/servidor/resolvedores.ts`, `packages/nucleo/src/servidor/baixar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: `http://` recusado nos resolvedores e em localhost sem a opção; versão `..`/`-x` recusada.
  *Origem:* host-1.1 · PR #12 · filha + qa segurança

- [ ] **1.3 — Testes de redirecionamento com sucesso e dos limites**
  *O que fazer:* testes que seguem um redirecionamento https até o fim, que estouram o limite de 5 saltos e que
  estouram o tempo total.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* cada teste falha se a regra correspondente for removida.
  *Origem:* host-1.1 · PR #12 · qa
