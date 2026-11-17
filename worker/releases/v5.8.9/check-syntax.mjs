import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}
const files = (await collect(process.cwd())).sort();
if (!files.length) throw new Error("Nenhum arquivo JavaScript encontrado.");
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed++;
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe: ${file}\n`);
  }
}
if (failed) process.exit(1);
console.log(`Sintaxe aprovada: ${files.length} arquivos JavaScript.`);
