// Automated browser test: runs tests/browser/selftest.js inside a temporary copy of the production
// build in headless Chrome at phone, tablet and desktop sizes. Requires `npm run build` first.
// Chrome is found via $CHROME, the macOS default location, or google-chrome/chromium on PATH.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "..", "dist");
const viewports = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };

function findChrome() {
  const candidates = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.startsWith("/")) { if (existsSync(candidate)) return candidate; continue; }
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return "";
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing. Run: npm run build");
  process.exit(1);
}
const chrome = findChrome();
if (!chrome) {
  console.log("Browser tests SKIPPED: Chrome/Chromium not found (set CHROME=/path/to/chrome).");
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "abl-guide-browser-"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Run Chrome with its DOM dump written to a file and return the dump once the self-test report
// is complete. Chrome is then stopped by us: on some systems (e.g. macOS with Google's updater)
// headless Chrome lingers after --dump-dom instead of exiting.
async function dumpDom(name, width, height, url) {
  const out = join(work, name + ".html");
  const fd = openSync(out, "w");
  const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "--disable-sync",
    `--user-data-dir=${join(work, "profile-" + name)}`, `--window-size=${width},${height}`,
    // Virtual time lets Chrome finish despite the page's endless (decorative) CSS animation.
    "--virtual-time-budget=3000", "--dump-dom", url], { stdio: ["ignore", fd, "ignore"], detached: true });
  closeSync(fd);
  let exited = false;
  child.on("exit", () => { exited = true; });
  try {
    for (let waited = 0; waited < 120000; waited += 250) {
      const dom = readFileSync(out, "utf8");
      if (/<pre id="selftest-results">[\s\S]*?<\/pre>/.test(dom) && /<\/html>/.test(dom)) return dom;
      if (exited) return dom;
      await sleep(250);
    }
    return readFileSync(out, "utf8");
  } finally {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
  }
}

let failures = 0;
try {
  cpSync(dist, join(work, "site"), { recursive: true });
  const page = join(work, "site", "index.html");
  writeFileSync(page, readFileSync(page, "utf8").replace("</body>", '<script src="selftest.js"></script>\n</body>'));
  cpSync(join(here, "selftest.js"), join(work, "site", "selftest.js"));
  for (const [name, [width, height]] of Object.entries(viewports)) {
    const dom = await dumpDom(name, width, height, pathToFileURL(page).href);
    const match = /<pre id="selftest-results">([\s\S]*?)<\/pre>/.exec(dom);
    if (!match) { console.error(`${name}: self-test did not report`); failures += 1; continue; }
    const report = JSON.parse(match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    const failed = report.results.filter((result) => !result.ok);
    console.log(`${name} ${report.viewport.join("x")}: ${report.results.length - failed.length}/${report.results.length} checks passed`);
    for (const result of failed) console.log(`  ✖ ${result.name}${result.detail ? " — " + result.detail : ""}`);
    failures += failed.length;
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failures) { console.error(`Browser tests FAILED (${failures})`); process.exit(1); }
console.log("Browser tests passed");
