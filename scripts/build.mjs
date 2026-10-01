// Production build: copy src/ to dist/ and verify the output is a portable static site.
// No dependencies. Usage: node scripts/build.mjs   (or: npm run build)
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
cpSync(src, dist, { recursive: true });

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

// Portability checks: relative asset paths only, nothing tied to this machine or a server.
const forbidden = [/localhost/i, /127\.0\.0\.1/, /file:\/\//i, /\/Users\//, /ABL-v8\.1-integration/, /https?:\/\//i];
const problems = [];
for (const file of files(dist)) {
  if (!/\.(html|css|js|svg)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    // Not requests: the SVG namespace identifier, and the two ABL portal addresses the guide tells
    // customers to type (ABL's own local web page and its first-time setup address).
    const scrubbed = text.replaceAll("http://www.w3.org/2000/svg", "").replaceAll("http://abl.local", "")
      .replaceAll("http://10.42.0.1", "");
    if (pattern.test(scrubbed)) problems.push(`${relative(dist, file)}: contains ${pattern}`);
  }
  if (file.endsWith(".html")) {
    for (const [, ref] of text.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
      if (ref.startsWith("/")) problems.push(`${relative(dist, file)}: absolute path ${ref}`);
      else if (!existsSync(join(dirname(file), ref))) problems.push(`${relative(dist, file)}: missing ${ref}`);
    }
  }
}
if (problems.length) {
  console.error("Build check failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
const size = files(dist).reduce((sum, file) => sum + statSync(file).size, 0);
console.log(`Built ${files(dist).length} files (${Math.round(size / 1024)} KB) into ${relative(process.cwd(), dist) || "dist"}/`);
