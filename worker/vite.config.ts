import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Vite Plugin v2 usa cloudflare.config.ts e gera o Build Output do cf CLI.
export default defineConfig({
  plugins: [cloudflare()]
});
