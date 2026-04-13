import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const targets = [
  path.join(projectRoot, "node_modules", "mcp-use", "dist", "src", "server", "index.js"),
  path.join(projectRoot, "node_modules", "mcp-use", "dist", "src", "server", "index.cjs"),
];

const replacements = [
  ["    const viteModule = await import(vitePath);", "    const viteModule = await import(pathToFileURL(vitePath).href);"],
  ["    const reactModule = await import(reactPluginPath);", "    const reactModule = await import(pathToFileURL(reactPluginPath).href);"],
  ["    const tailwindModule = await import(tailwindPath);", "    const tailwindModule = await import(pathToFileURL(tailwindPath).href);"],
];

for (const target of targets) {
  let source;

  try {
    source = await readFile(target, "utf8");
  } catch {
    continue;
  }

  let patched = source;
  let changed = false;

  for (const [from, to] of replacements) {
    if (patched.includes(to)) {
      continue;
    }

    if (patched.includes(from)) {
      patched = patched.replace(from, to);
      changed = true;
    }
  }

  if (changed) {
    await writeFile(target, patched, "utf8");
    console.log(`Patched ${path.relative(projectRoot, target)}`);
  }
}