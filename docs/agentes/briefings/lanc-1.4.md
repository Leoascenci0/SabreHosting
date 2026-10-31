# Briefing lanc-1.4 — Mods do grupo iguais para todos (corte: cartório + núcleo; tela depois)

BASE: cfd0ca4bc255e80d88c96c340ccabab82aeaafef · RAMO: roadmap/lanc-1.4 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; seguranca (download de terceiro, cartório autenticado); integridade (troca atômica, hash)
TRIAGEM: M1 + M7 ; ~150–200 linhas + teste; risco alto (cartório + download de terceiro). Não há lista de mods no cartório (config_grupo só tem versão e sha1): tabela nova com trigger e dono (só o dono do grupo edita; config_grupo.dono_pc_id em services/cartorio/src/banco.ts). REAPROVEITAR baixarConferido (packages/nucleo/src/servidor/baixar.ts:~247), hashDoArquivo (integridade/hash.ts), padrão de versoes.test.ts (fetch falso). NÃO escrever download nem conferência de hash próprios. Modrinth/papermc/neoforged estão BLOQUEADOS na nuvem: nenhum teste pode usar rede real (fetch falso).
 Passos: 1) cartório: tabela mods do grupo (nome, versão, url, sha512/hash, lado cliente/servidor) + GET/PUT autenticado, PUT só do dono; cliente em packages/nucleo/src/cartorio/cliente.ts (+validador em tipos.ts). 2) packages/nucleo/src/launcher/mods.ts: diff entre a lista e a pasta mods da instância (e do servidor), baixar o que falta com hash conferido (host da URL limitado a cdn.modrinth.com / allowlist), trocar atômico, remover o que saiu da lista (só arquivos que o SabreHosting colocou: marcar numa lista de gerenciados; nunca apagar mod do amigo que não é do grupo). 3) NÃO fazer a tela "Mods do grupo" (Configurações › Grupo) nem ligar em deps-reais/principal: fica como Melhoria encontrada (lanc-1.4b).
 Item que mexe em services/: rode os testes também como usuário comum (S-03: useradd -m teste; su teste -c ...) se tocar infra/.

## Item (texto literal do roadmap)
**1.4 — Mods do grupo iguais para todos** — lista de mods do grupo (nome, versão, hash) guardada no cartório; o SabreHosting baixa do Modrinth com hash conferido e coloca na instância e no servidor (mods Fabric rodam pelo Sinytra Connector, D5).
*Arquivo:* packages/nucleo/src/launcher/mods.ts (+ cartório e cliente)
**Tela no app:** Configurações › Grupo › "Mods do grupo" (só o dono edita) — NESTE PR fica de fora (vira lanc-1.4b).
*Confirmação:* teste: hash errado recusado; mod removido da lista sai da instância.
*Depende de:* lanc-1.2 ✅ · D5 decidida.

## Decisões que valem para este item
D5 (mods Fabric+Forge pelo NeoForge+Sinytra), versão escolhida pelo dono (DECISOES.md).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/lanc-1.4.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois): hash errado recusado, mod removido sai, só o dono edita, mod do amigo intocado
- [ ] `npm run vistoria` APROVADA
- [ ] PR com seções do modelo, Triagem/Segurança/Integridade/Enxugamento/Roteamento e `Tela no app:` ("fica para o lanc-1.4b")

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos, apps/desktop.

## O que NÃO decidir
Quais mods o grupo usa (dado do dono, não do código).
