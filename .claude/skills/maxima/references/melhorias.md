# Roadmap de melhoria (parte da skill `maxima`)

Adaptado do SEURBH (Eliel, 28/10/2026). Cada roadmap de etapa tem um **roadmap de melhoria** irmão:
implementando um item do `docs/roadmap-sync.md`, a sessão achou uma melhoria → ela vira item no
`docs/roadmap-sync-melhoria.md` (sigla `syncmel`) e entra nas **próximas ondas**. Nenhuma ideia boa se perde, e o
item em curso continua pequeno (regra 5 do implementador).

## 1. O que é melhoria (e o que não é)

- **É:** tela mais clara, passo a menos para o amigo, número fixo que devia ir para Configurações, transferência mais
  leve, teste que falta, texto de ajuda, código repetido que dá para juntar sem mudar comportamento.
- **Não é:** defeito ou risco fora do escopo ("Achados fora do escopo" → Backlog do milestone); segurança ou
  integridade grave (para a rodada); o que o próprio item já manda fazer.

## 2. Quem escreve

1. **A filha não edita roadmap.** Descreve cada melhoria na seção "Melhorias encontradas" do PR, no formato do §3, ou
   "Melhorias encontradas: nenhuma".
2. **A Máxima, no merge**, grava no `docs/roadmap-<sigla>-melhoria.md` (cria se faltar), sem duplicar: melhoria igual
   ganha só mais uma linha *Origem:*.

## 3. Formato do item de melhoria

```markdown
- [ ] **N.M — <título curto>**
  *O que fazer:* <1–3 linhas>
  *Arquivo:* <caminhos>
  **Tela no app:** <Configurações › … ou "não se aplica">
  *Confirmação:* <como conferir>
  *Origem:* <sigla-id do item> · PR #<n> · <filha | qa | máxima>
```

Bloco = o bloco do item de origem. Sigla do roadmap de melhoria = sigla do tema + `mel`.
