# Bom-dia

_Reescrito pela coordenadora da Máxima em 31/10/2026, 15:10, ao passar o bastão. Estado completo em
`docs/ops/rodadas/coordenacao-2026-10-31.md`._

- **O que entrou hoje (Ondas 20–25, ~40 PRs, vistoria APROVADA na `main` a cada onda):**
  - **Grupo:** tirar PC do grupo (cartório, rede e tela), só o dono; escolha da versão do Minecraft pelo dono
    (Configurações › Servidor › Versão, qualquer versão, padrão 1.21.1) com backup antes de trocar.
  - **Backups:** telas de backups e Configurações; rotação ligada (10 mais novos + tudo dos últimos 7 dias, nunca o
    último bom); destino em pasta sincronizada (Google Drive para Computador) com a mesma regra.
  - **Mundo em todos (M3):** envio do mundo pela rede privada com limites; troca segura que se recupera se o app cair;
    espalhar a versão nova com trava própria (atualiza mesmo com alguém hospedando); pré-cópia para a troca de host.
  - **Piloto:** importar o mundo da hospedagem direto do .zip (tela + tutorial).
  - **Dependabot #95/#96** mergeados sozinhos (sua regra nova).
- **Tutoriais para testar:** `docs/tutoriais/piloto-importar.md` (importar o mundo real, no seu PC).
- **Decidi por você** (reversíveis, com PR): "De quem" = "Este PC"; envio do mundo 60 s ocioso / 16 conexões / banda
  10 MB/s; PC tirado ainda baixa por até 30 s; nuvem não é fonte do espalhar; pasta sincronizada apaga também na
  nuvem (tela avisa); porta do espalhar 25570 (só rede privada); importar com grupo já existente só pelo dono, como
  versão nova; versão órfã sem pacote nunca vira a "mais nova".
- **Esperando você:**
  1. **Liberar `repo.papermc.io` e `maven.neoforged.net`** no ambiente (você disse que libera; às 15:08 ainda bloqueados).
     Destrava a troca do host no proxy (rede-2.2) e os mods na 1.20.1.
  2. **Importar o mundo real** pelo tutorial acima.
  3. **Provas no PC Windows** (PRs #101, #114, #144) e tirar o PC da rede privada de verdade (redemel-1.3, máquina real).
  4. **D9** (assinatura do instalador, custo) quando chegar o app-3.2.
- **Custo de hoje:** ondas e filhas ~US$ 48 (20 e 21 não medidas; 22 7,78; 23 ~15,0; 24 ~15,2; 25 ~10,2) +
  coordenadora US$ 5,09 (era US$ 43 na madrugada, com um chat fazendo tudo).
- **O que não foi verificado:** nada rodou num PC Windows nem na máquina da nuvem de verdade; rede privada real não testada.
