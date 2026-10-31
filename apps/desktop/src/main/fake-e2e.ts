// Só entra em cena com SABRE_E2E=1 (principal.ts faz o import dinâmico sob essa guarda).
// Cartório falso com estado + servidor Minecraft de mentira: nenhuma porta abre, nenhum mundo é tocado.
import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import type { RespostaTrava } from "@sabrehosting/nucleo/cartorio/tipos";
import { erroSemGrupo, type DepsInicio } from "./inicio.js";

// "dono-eu*": app reaberto com a trava ainda em nome deste PC, sem servidor desta sessão (com ou sem órfão vivo).
export type Cenario = "ninguem" | "outro" | "eu" | "sem-cartorio" | "dono-eu" | "dono-eu-orfao";
const NEO = "21.1.172";
const MEU_ID = 1;
const ENDERECO = "mundo.exemplo.net";

export interface Espiao {
  spawns: { cmd: string; args: readonly string[]; cwd: unknown }[];
}

/** Processo filho de mentira: diz "Done (" ao subir e sai ao receber "stop". */
function filhoFalso(registrar: (e: string) => void): ChildProcess {
  const f = new EventEmitter() as EventEmitter & Record<string, unknown>;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  stdin.on("data", (d: Buffer) => {
    if (String(d).includes("stop")) {
      registrar("parou");
      setTimeout(() => f.emit("close", 0), 10);
    }
  });
  f["stdin"] = stdin;
  f["stdout"] = stdout;
  f["stderr"] = new PassThrough();
  f["pid"] = 1;
  f["kill"] = () => f.emit("close", null);
  setTimeout(
    () =>
      stdout.write(
        '[12:00:00] [Server thread/INFO] [minecraft/DedicatedServer]: Done (0.1s)! For help, type "help"\n',
      ),
    300,
  );
  return f as unknown as ChildProcess;
}

export function criarDepsE2E(cenario: Cenario, espiao: Espiao): DepsInicio {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-e2e-servidor-"));
  writeFileSync(join(pasta, "eula.txt"), "eula=true\n");
  const dirArgs = join(pasta, "libraries/net/neoforged/neoforge", NEO);
  mkdirSync(dirArgs, { recursive: true });
  for (const a of ["unix_args.txt", "win_args.txt"]) writeFileSync(join(dirArgs, a), "# args\n");

  // Ordem dos fatos, para o E2E provar "parou → soltou a trava → só então saiu".
  const registrar = (evento: string): void => {
    const arquivo = process.env["SABRE_E2E_REGISTRO"];
    if (arquivo) appendFileSync(arquivo, `${evento}\n`);
  };
  let dono: { id: number; nome: string } | null =
    cenario === "outro"
      ? { id: 2, nome: "Lucas" }
      : cenario.startsWith("dono-eu")
        ? { id: MEU_ID, nome: "Este PC" }
        : null;
  let epoca = 1;
  const aceita = (): RespostaTrava => ({
    ok: true,
    epoca,
    expiraEm: Date.now() + 60_000,
    renovarMs: 20_000,
  });
  const recusa = (): RespostaTrava => ({
    ok: false,
    erro: "ocupada",
    motivo: "ocupada",
    donoPcId: dono?.id ?? null,
    epoca,
    expiraEm: Date.now() + 60_000,
  });
  const cliente = {
    estadoTrava: async () => {
      if (cenario === "sem-cartorio") throw erroSemGrupo();
      return { dono, epoca, expiraEm: Date.now() + 60_000, prazoMs: 60_000, renovarMs: 20_000 };
    },
    pegar: async () => {
      if (dono && dono.id !== MEU_ID) return recusa(); // como o cartório: o próprio dono pega de novo
      dono = { id: MEU_ID, nome: "Este PC" };
      return aceita();
    },
    renovar: async () => (dono?.id === MEU_ID ? aceita() : recusa()),
    soltar: async () => {
      registrar("soltar");
      if (dono?.id === MEU_ID) dono = null;
      epoca++;
      return aceita();
    },
  };

  const copias: string[] = [];
  (globalThis as Record<string, unknown>)["__sabreE2EInicio"] = { copias, dono: () => dono };
  return {
    lerTrava: cliente.estadoTrava,
    hospedar: async (aoPerder) => {
      await new Promise((ok) => setTimeout(ok, 400)); // dá tempo de o E2E ver o progresso
      return hospedar({
        cliente,
        aoPerder,
        pasta,
        javaPath: "java-falso",
        versaoNeoForge: NEO,
        plataforma: "linux",
        spawnFn: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => {
          espiao.spawns.push({ cmd, args, cwd: opcoes.cwd });
          return filhoFalso(registrar);
        },
      });
    },
    eu: async () => ({ id: MEU_ID }),
    servidorOrfao: async () => cenario === "dono-eu-orfao",
    endereco: process.env["SABRE_E2E_SEM_ENDERECO"] === "1" ? "" : ENDERECO,
    copiar: (t) => void copias.push(t),
  };
}
