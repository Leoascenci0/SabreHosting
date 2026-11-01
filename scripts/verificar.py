#!/usr/bin/env python3
"""Verificador do SabreHosting (trava de commit e revisão de ramo).

Uso:
  python3 scripts/verificar.py --staged             # pre-commit: só o que está em stage
  python3 scripts/verificar.py --base origin/main   # revisão: o que o ramo muda em relação à base

Reprova (exit 1):
  - commit ou ramo na main;
  - segredo provável (chave privada, token, .env com valor);
  - mundo de Minecraft fora de tests/mundos/ (*.mca, level.dat, playerdata/);
  - marcador de conflito de merge (abertura, divisória e fechamento, nessa ordem);
  - jar de servidor, executável ou arquivo maior que o teto (scripts/limites.json, "arquivo_max_kb");
  - roadmap 100% feito ainda em docs/ (vai para docs/concluidos/; o roadmap-corr.md fica);
  - implementador mexendo em arquivo fora do alcance (só com --implementador).
Só usa a biblioteca padrão.
"""
import argparse
import json
import os
import re
import subprocess
import sys

RAIZ = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or "."

PADROES_SEGREDO = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "chave privada"),
    (re.compile(r"\bPrivateKey\s*=\s*[A-Za-z0-9+/]{40,}={0,2}"), "chave privada do WireGuard"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"), "token do GitHub"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "chave da AWS"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"), "chave de API"),
    (re.compile(r"(?i)\b(token|secret|senha|password|forwarding[-_]secret)\b\s*[:=]\s*['\"][^'\"\s]{12,}['\"]"), "segredo em texto"),
]
EXT_BINARIA_PROIBIDA = (".jar", ".exe", ".msi", ".dll", ".zip", ".mca", ".mcr", ".dat_old")
FORA_DO_ALCANCE_IMPL = ("CLAUDE.md", ".claude/", "docs/MILESTONE.md")
ITEM_ROADMAP = re.compile(r"^- \[( |x)\] \*\*\d+\.\d+ — ", re.M)
ROADMAP_PERMANENTE = ("docs/roadmap-corr.md",)  # lista permanente de correções


def achar_conflito(texto):
    """Linha (1-based) da abertura de um bloco de conflito; `=======` sozinho não conta."""
    abertura = None
    divisoria = False
    for n, linha in enumerate(texto.splitlines(), 1):
        if linha.startswith("<" * 7 + " "):
            abertura, divisoria = n, False
        elif abertura and linha == "=" * 7:
            divisoria = True
        elif abertura and divisoria and linha.startswith(">" * 7 + " "):
            return abertura
    return None


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True, cwd=RAIZ)
    return r.stdout


def limites():
    try:
        with open(os.path.join(RAIZ, "scripts", "limites.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def arquivos(staged, base):
    if staged:
        saida = git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    else:
        saida = git("diff", "--name-only", "--diff-filter=ACMR", f"{base}...HEAD")
    return [a for a in saida.splitlines() if a.strip()]


def conteudo(caminho, staged):
    if staged:
        r = subprocess.run(["git", "show", f":{caminho}"], capture_output=True, cwd=RAIZ)
        return r.stdout
    try:
        with open(os.path.join(RAIZ, caminho), "rb") as f:
            return f.read()
    except OSError:
        return b""


def roadmaps_concluidos_fora(staged):
    """Roadmaps em docs/ com todos os itens marcados (CLAUDE.md: roadmap 100% feito vai para docs/concluidos/)."""
    caminhos = git("ls-files", "docs/roadmap-*.md").split() if staged else \
        sorted(f"docs/{n}" for n in os.listdir(os.path.join(RAIZ, "docs"))
               if n.startswith("roadmap-") and n.endswith(".md")) if os.path.isdir(os.path.join(RAIZ, "docs")) else []
    fora = []
    for caminho in caminhos:
        if caminho in ROADMAP_PERMANENTE or "/" in caminho[len("docs/"):]:
            continue
        marcas = ITEM_ROADMAP.findall(conteudo(caminho, staged).decode("utf-8", errors="ignore"))
        if marcas and all(m == "x" for m in marcas):
            fora.append(caminho)
    return fora


def eh_mundo(caminho):
    if caminho.startswith("tests/mundos/"):
        return False
    nome = os.path.basename(caminho)
    return nome.endswith((".mca", ".mcr")) or nome in ("level.dat", "level.dat_old", "session.lock") \
        or "/playerdata/" in f"/{caminho}" or "/region/" in f"/{caminho}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--staged", action="store_true")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--implementador", action="store_true", help="aplica a lista de fora do alcance")
    a = ap.parse_args()

    erros, avisos = [], []
    ramo = git("branch", "--show-current").strip()
    if ramo == "main":
        erros.append("você está na main: crie um ramo (CLAUDE.md § Git e entrega)")

    email = git("config", "user.email").strip()
    if email and email != "asc.eliel@gmail.com":
        avisos.append(f"user.email é '{email}', o esperado é asc.eliel@gmail.com")

    teto_kb = int(limites().get("arquivo_max_kb", 1024))
    for caminho in arquivos(a.staged, a.base):
        dados = conteudo(caminho, a.staged)
        if eh_mundo(caminho):
            erros.append(f"{caminho}: arquivo de mundo fora de tests/mundos/ (regra de ouro 6)")
            continue
        if caminho.lower().endswith(EXT_BINARIA_PROIBIDA) and not caminho.startswith("tests/mundos/"):
            erros.append(f"{caminho}: binário proibido no repositório (jar, executável, zip)")
            continue
        if os.path.basename(caminho).startswith(".env") and not caminho.endswith(".exemplo"):
            erros.append(f"{caminho}: arquivo .env não vai para o git (use .env.exemplo)")
        if len(dados) > teto_kb * 1024 and not caminho.startswith(".claude/skills/"):  # skills de terceiros vêm prontas
            erros.append(f"{caminho}: {len(dados)//1024} kB, teto {teto_kb} kB (scripts/limites.json)")
        if a.implementador and caminho.startswith(FORA_DO_ALCANCE_IMPL):
            erros.append(f"{caminho}: fora do alcance do implementador (CLAUDE.md, regra 2)")
        texto = dados.decode("utf-8", errors="ignore")
        linha = achar_conflito(texto)
        if linha:
            erros.append(f"{caminho}:{linha}: marcador de conflito de merge (resolva o conflito antes de commitar)")
        if caminho == "scripts/verificar.py" or caminho.endswith("/seguranca.md"):
            continue  # o próprio verificador e a doc citam os padrões
        for padrao, nome in PADROES_SEGREDO:
            if padrao.search(texto):
                erros.append(f"{caminho}: parece conter {nome} (nunca segredo no git)")

    for caminho in roadmaps_concluidos_fora(a.staged):
        erros.append(f"{caminho}: roadmap 100% feito; mova para docs/concluidos/ (git mv) no mesmo PR")

    for av in avisos:
        print(f"AVISO: {av}")
    for e in erros:
        print(f"ERRO: {e}")
    if erros:
        print(f"REPROVADO ({len(erros)} erro(s))")
        return 1
    print("APROVADO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
