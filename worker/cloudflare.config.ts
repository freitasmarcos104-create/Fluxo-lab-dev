import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./index.js" with { type: "cf-worker" };

// Configuração tipada do único Worker oficial do Fluxo Lab.
// Os nomes e IDs abaixo espelham os bindings já existentes em produção.
export default defineConfig({
  accountId: "72bf422494f3d27c3561ba87daa5bd7b",
  worker: {
    name: "fluxo-lab",
    entrypoint,
    compatibilityDate: "2026-09-11",
    compatibilityFlags: [],
    workersDev: true,
    observability: {
      enabled: true,
      headSamplingRate: 1,
      logs: {
        enabled: true,
        headSamplingRate: 1,
        invocationLogs: true,
        persist: true
      },
      traces: {
        enabled: false,
        headSamplingRate: 1,
        persist: true
      }
    },
    env: {
      AI: bindings.ai(),
      db: bindings.d1({
        id: "1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6",
        name: "fluxo-lab-db"
      }),
      DOWNLOADS: bindings.r2({ name: "fluxo-lab-downloads" }),
      IMPORT_BUCKET: bindings.r2({ name: "fluxo-lab-importacoes" }),
      STL_BUCKET: bindings.r2({ name: "fluxo-lab-stl" })
    }
  }
});
