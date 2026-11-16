import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// O PDF.js é servido por rota dinâmica do Worker, não por um arquivo do repositório.
// Mantê-lo externo preserva o import runtime /importacoes/recursos/pdf.mjs.
export default defineConfig({
  plugins: [cloudflare()],
  build: {
    rollupOptions: {
      external: [
        "/importacoes/recursos/pdf.mjs",
        "/importacoes/recursos/pdf.worker.mjs"
      ]
    }
  }
});
