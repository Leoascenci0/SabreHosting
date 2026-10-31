# Plano lanc-1.4 — Mods do grupo iguais para todos (cartório + núcleo; tela fica para o lanc-1.4b)

Triagem: M1 (reaproveitar `baixarConferido`, `hashDoArquivo`, padrão de `configuracao.ts`) + M7 (tabela e módulo novos).

## Passos
1. **Cartório** (`services/cartorio/src/mods.ts` + migração 10 em `banco.ts` + rotas em `servidor.ts`): tabela `mods_grupo`
   (nome, versão, arquivo, url, sha512, lado cliente/servidor/ambos). `GET /grupo/mods` (qualquer PC com token) e
   `PUT /grupo/mods` (só o dono; troca a lista inteira numa transação). Validação: url https de `cdn.modrinth.com`,
   sha512 de 128 hex, nome de arquivo `.jar` simples (sem `/`, `\`, `..`), nomes de arquivo únicos, máximo 200.
2. **Cliente/tipos** (`packages/nucleo/src/cartorio/`): `lerModsGrupo` e `gravarModsGrupo` + `validarModsGrupo` (a resposta vem
   da rede, então é revalidada, inclusive host e nome do arquivo).
3. **Núcleo** (`packages/nucleo/src/launcher/mods.ts`): `sincronizarMods({lista, pasta, lado})` — baixa o que falta com
   `baixarConferido` (hash sha512), troca atômica (já feita por ele), remove só o que o SabreHosting colocou (lista de
   gerenciados `.sabrehosting-mods.json` na pasta, gravada de forma atômica), nunca toca mod do amigo.
4. **Fora**: tela "Mods do grupo" e ligação em `deps-reais`/`principal` → lanc-1.4b.

## Testes (TDD, rede só com `fetch` falso)
- hash errado recusado (nada fica na pasta); mod removido da lista sai da pasta; mod do amigo intocado;
  mod gerenciado que o amigo editou/outro com mesmo nome não gerenciado não é sobrescrito;
  host fora da allowlist recusado antes de baixar; só o dono grava (403); lista inválida (400); GET para qualquer PC.
- Migração 9 → 10 mantém dados; testes que afirmam `versao: 9` passam a `10`.

## Regras de ouro tocadas
Mundo não é tocado. Download de terceiro: hash conferido, host em allowlist, https. Troca atômica pelo `baixarConferido`.
