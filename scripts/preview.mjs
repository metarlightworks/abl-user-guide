// Local preview of the production build, served under /abl/user-guide/ exactly as on the
// METAR LightWorks site. No dependencies. Usage: npm run preview  (then open the printed URL)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const base = "/abl/user-guide/";
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png" };

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing. Run: npm run build");
  process.exit(1);
}
createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://preview").pathname);
  if (path === "/" || path === base.slice(0, -1)) {
    response.writeHead(302, { Location: base }).end();
    return;
  }
  if (!path.startsWith(base)) {
    response.writeHead(404).end("Not found");
    return;
  }
  let file = normalize(join(dist, path.slice(base.length)));
  if (!file.startsWith(dist)) { response.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { response.writeHead(404).end("Not found"); return; }
  response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  response.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log(`ABL User Guide preview: http://127.0.0.1:${port}${base}`));
