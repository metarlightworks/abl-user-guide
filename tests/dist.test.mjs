// The production output is a portable static site (run after `npm run build`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("dist contains the static site and nothing else", () => {
  assert.ok(existsSync(join(dist, "index.html")), "run npm run build first");
  const names = files(dist).map((path) => path.slice(dist.length + 1)).sort();
  const pages = names.filter((name) => !/^assets\/(abl|portal)\/[a-z0-9-]+\.png$/.test(name));
  assert.deepEqual(pages, ["assets/icon.svg", "assets/n247ap-scene.png", "index.html", "js/app.js", "js/model.js", "styles.css"]);
  assert.ok(names.filter((name) => name.startsWith("assets/abl/")).length >= 15);
  assert.ok(names.filter((name) => name.startsWith("assets/portal/")).length >= 5);
});

test("every image the guide refers to is packaged", () => {
  const model = readFileSync(join(dist, "js/model.js"), "utf8");
  const refs = [...model.matchAll(/(abl|portal)\("([a-z0-9-]+)"/g)].map((m) => `assets/${m[1]}/${m[2]}.png`);
  assert.ok(refs.length >= 20);
  for (const ref of refs) assert.ok(existsSync(join(dist, ref)), ref);
});

test("every reference is relative and packaged; no external requests", () => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]).filter((ref) => !ref.startsWith("#"));
  assert.ok(refs.length >= 4);
  for (const ref of refs) {
    assert.doesNotMatch(ref, /^(\/|https?:|file:)/, ref);
    assert.ok(existsSync(join(dist, ref)), ref);
  }
  for (const file of files(dist).filter((path) => /\.(html|css|js)$/.test(path))) {
    // The only addresses allowed are the ABL portal addresses customers are told to type.
    const body = readFileSync(file, "utf8").replaceAll("http://abl.local", "").replaceAll("http://10.42.0.1", "");
    assert.doesNotMatch(body, /https?:\/\/|localhost|127\.0\.0\.1|\/Users\/|fetch\(|XMLHttpRequest|WebSocket/, file);
  }
});

test("the page is identified as a demonstration", () => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  assert.match(html, /DEMONSTRATION/);
  assert.match(html, /Not connected to any ABL, Jeppesen account, database or USB/);
});
