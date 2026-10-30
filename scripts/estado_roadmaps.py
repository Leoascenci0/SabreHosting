#!/usr/bin/env python3
"""Estado dos roadmaps do SabreHosting (para /comecar e a Máxima).

Uso: python3 scripts/estado_roadmaps.py [sigla]
Mostra, por roadmap, quantos itens faltam e, para cada item aberto, o que trava
(Depende de: item ainda aberto, ESPERA DECISÃO). Lista os ramos roadmap/* remotos.
"""
import glob
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEM = re.compile(r"^- \[( |x)\] \*\*(\d+\.\d+) — (.+?)\*\*")


def ler(caminho):
    with open(caminho, encoding="utf-8") as f:
        return f.read().splitlines()


def main():
    filtro = sys.argv[1] if len(sys.argv) > 1 else None
    feitos, itens = set(), []
    # Roadmaps 100% feitos moram em docs/concluidos/ e ainda contam como dependência cumprida.
    caminhos = sorted(glob.glob(os.path.join(RAIZ, "docs", "roadmap-*.md")))
    caminhos += sorted(glob.glob(os.path.join(RAIZ, "docs", "concluidos", "roadmap-*.md")))
    for caminho in caminhos:
        sigla = os.path.basename(caminho)[len("roadmap-"):-3].replace("-melhoria", "mel")
        atual = None
        for linha in ler(caminho):
            m = ITEM.match(linha)
            if m:
                atual = {"sigla": sigla, "id": f"{sigla}-{m.group(2)}", "titulo": m.group(3),
                         "feito": m.group(1) == "x", "deps": [], "decisao": False}
                itens.append(atual)
                if atual["feito"]:
                    feitos.add(atual["id"])
                continue
            if atual is None:
                continue
            if "*Depende de:*" in linha:
                atual["deps"] = re.findall(r"\b([a-z]+-\d+\.\d+)\b", linha)
            if "ESPERA DECISÃO" in linha:
                atual["decisao"] = True

    por_sigla = {}
    for it in itens:
        por_sigla.setdefault(it["sigla"], []).append(it)
    for sigla, lista in por_sigla.items():
        if filtro and sigla != filtro:
            continue
        abertos = [i for i in lista if not i["feito"]]
        print(f"\n## {sigla}: {len(lista) - len(abertos)}/{len(lista)} feitos")
        for i in abertos:
            trava = [d for d in i["deps"] if d not in feitos]
            motivo = []
            if trava:
                motivo.append("espera " + ", ".join(trava))
            if i["decisao"]:
                motivo.append("ESPERA DECISÃO")
            estado = "PRONTO" if not motivo else "; ".join(motivo)
            print(f"- {i['id']} — {i['titulo']} [{estado}]")

    ramos = subprocess.run(["git", "branch", "-r", "--list", "origin/roadmap/*"],
                           capture_output=True, text=True, cwd=RAIZ).stdout.split()
    print("\nRamos em andamento: " + (", ".join(ramos) if ramos else "nenhum"))


if __name__ == "__main__":
    main()
