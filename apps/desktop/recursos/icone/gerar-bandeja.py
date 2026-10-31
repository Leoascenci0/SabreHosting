"""Gera bandeja-16/24/32/48.png a partir de icone-512.png.
Uso: python3 -I gerar-bandeja.py icone-512.png . _
Precisa só do Pillow; roda fora do app (não é dependência do projeto)."""
import sys
from collections import deque
from PIL import Image
src = Image.open(sys.argv[1]).convert("RGBA")
c = src.crop((175, 50, 440, 290))
w, h = c.size
px = c.load()

def escuro(p):  # fundo quase preto (levemente azulado)
    return p[0] < 38 and p[1] < 44 and p[2] < 52

def verde(p):  # blocos de grama
    return p[1] > p[0] + 15 and p[1] > p[2] + 15

# fundo = escuro ligado à borda; grama = verde (e escuro colado nela)
seen = set()
fila = deque((x, y) for x in range(w) for y in (0, h - 1)) if False else deque()
for x in range(w):
    fila.extend([(x, 0), (x, h - 1)])
for y in range(h):
    fila.extend([(0, y), (w - 1, y)])
while fila:
    x, y = fila.popleft()
    if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
        continue
    p = px[x, y]
    if not (escuro(p) or verde(p)):
        continue
    seen.add((x, y))
    fila.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
for x, y in seen:
    px[x, y] = (0, 0, 0, 0)
# grama que não encosta na borda
for y in range(h):
    for x in range(w):
        if verde(px[x, y]) and px[x, y][3]:
            px[x, y] = (0, 0, 0, 0)
# a cabeça vai sobre um azulejo escuro de cantos arredondados (a parte preta do pelo
# some em barra de tarefas clara se o fundo for transparente)
from PIL import ImageDraw
T = 480
azul = Image.new("RGBA", (T, T), (0, 0, 0, 0))
ImageDraw.Draw(azul).rounded_rectangle((0, 0, T - 1, T - 1), radius=T // 5, fill=(11, 15, 20, 255))
lado = int(T * 0.90)
cab = c.resize((lado, int(lado * h / w)), Image.LANCZOS)
azul.alpha_composite(cab, ((T - cab.width) // 2, (T - cab.height) // 2))
for t in (16, 24, 32, 48):
    azul.resize((t, t), Image.LANCZOS).save(f"{sys.argv[2]}/bandeja-{t}.png")
