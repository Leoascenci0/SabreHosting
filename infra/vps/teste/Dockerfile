# Teste do instalar.sh num Ubuntu limpo, sem tocar máquina nenhuma:
#   docker build -f infra/vps/teste/Dockerfile -t sabre-vps-teste .
# Roda a sintaxe, o shellcheck e a simulação duas vezes (a 2ª não pode recriar usuário nem chave).
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends shellcheck && rm -rf /var/lib/apt/lists/*
COPY infra/vps /vps
WORKDIR /vps
RUN bash -n instalar.sh && bash -n instalar-velocity.sh && shellcheck instalar.sh instalar-velocity.sh
RUN export SABRE_SIMULAR=1 SABRE_ESTADO=/tmp/estado \
 && bash instalar.sh > /tmp/1.txt \
 && bash instalar.sh > /tmp/2.txt \
 && grep -q useradd /tmp/1.txt && ! grep -q useradd /tmp/2.txt \
 && grep -q 'wg genkey' /tmp/1.txt && ! grep -q 'wg genkey' /tmp/2.txt \
 && test "$(grep -c '^SIMULADO: ufw allow ' /tmp/2.txt)" = 3
