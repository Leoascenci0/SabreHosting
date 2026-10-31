# Plano hostmel-1.3 — testes de redirecionamento (sucesso e limites) e de tempo total

Só teste, em `packages/nucleo/src/servidor/baixar.test.ts`; `baixar.ts` não muda.

1. Servidor https local com certificado autoassinado gerado no teste (`openssl` em pasta temporária, nada commitado).
   A confiança nele vale só durante esses testes (`NODE_TLS_REJECT_UNAUTHORIZED=0` ligado e restaurado no `before/afterAll`).
2. Teste: 5 redirecionamentos (1 do http local + 4 https) até o 200 → baixa, hash confere, só o arquivo final.
3. Teste: 6 redirecionamentos → recusa, nada na pasta, o 6º salto não é seguido.
4. Teste: servidor que goteja + `tempoTotal` curto → "demorou demais", nada na pasta (`tempoSemDados` alto: só o total pode cortar).
5. Prova: mutação manual (não commitada) em `MAX_SALTOS`/`>=` e no timer de `tempoTotal`; cada teste cai.
6. Folga (S-01): `tempoTotal` 300 ms contra servidor que nunca termina, então não depende de velocidade da máquina.
