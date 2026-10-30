/**
 * Onde o token do PC fica guardado. No app entra o `safeStorage` do Electron (app-1.x); aqui só a interface, para o
 * núcleo nunca ler token de arquivo solto.
 */
export interface Cofre {
  guardar(token: string): Promise<void>;
  ler(): Promise<string | undefined>;
}

/** Cofre que some quando o processo fecha: testes e uso sem app. */
export function cofreEmMemoria(): Cofre {
  let guardado: string | undefined;
  return {
    guardar: async (token) => void (guardado = token),
    ler: async () => guardado,
  };
}
