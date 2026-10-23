// Unit tests for the guide's setup model (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.runInNewContext(readFileSync(join(root, "src/js/model.js"), "utf8"), context);
const M = context.window.ABLGuideModel;
// Values created inside the vm context have their own Array prototype; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));
const ids = (steps) => steps.map((step) => step.id);
const text = (value) => JSON.stringify(value);

test("only the owner's example registrations are used", () => {
  assert.deepEqual(plain([...M.TAILS]), ["N247AP", "N81JN"]);
  for (const aircraft of [1, 2]) {
    for (const avionics of Object.keys(M.AVIONICS)) {
      for (const charts of [true, false]) {
        const s = M.setup(aircraft, avionics, charts);
        for (const tail of text(s).match(/\bN[0-9]{1,5}[A-Z]{0,2}\b/g) || []) {
          assert.ok(M.TAILS.includes(tail), tail);
        }
      }
    }
  }
});

test("invalid answers give no setup", () => {
  assert.equal(M.setup(3, "ifd500", true), null);
  assert.equal(M.setup(1, "bogus", true), null);
});

test("one aircraft, one IFD500: 12 steps in the expected order, physically verified note", () => {
  const s = M.setup(1, "ifd500", true);
  assert.equal(s.aircraft.length, 1);
  assert.deepEqual(plain(s.aircraft[0].usbs), ["USB A"]);
  assert.equal(s.aircraft[0].charts, true);
  assert.deepEqual(plain(ids(M.steps(s))), ["two-ways", "wifi", "jeppesen", "aircraft", "avionics", "charts", "usb", "check",
    "prepare", "ready", "avionics-load", "load-nxt"]);
  assert.match(s.notes.join(" "), /physically verified/i);
  const usb = M.steps(s).find((step) => step.id === "usb");
  assert.match(usb.summary, /nothing to assign/);
  assert.equal(usb.see.length, 0);
  assert.equal(usb.ways, null);
});

test("IFD400: no chart coverage step, IFD400 validation note", () => {
  const s = M.setup(1, "ifd400", true);
  assert.equal(s.aircraft[0].charts, false);
  const steps = M.steps(s);
  const charts = steps.find((step) => step.id === "charts");
  assert.ok(charts && /does not use Electronic Charts/.test(charts.summary));
  assert.ok(!text(steps).includes("chart-coverage"));
  assert.match(s.notes.join(" "), /standalone IFD400-package workflow remains in physical validation/);
  assert.ok(!ids(M.steps(M.setup(1, "ifd400", false))).includes("charts"));
});

test("IFD550 + IFD440: Cockpit Setup keeps the installed units distinct", () => {
  const s = M.setup(1, "mixed", true);
  assert.equal(s.aircraft[0].avionics, "IFD 550 + IFD 440");
  const avionics = M.steps(s).find((step) => step.id === "avionics");
  assert.match(avionics.title, /Cockpit Setup/);
  assert.match(avionics.why, /IFD 550 and IFD 440/);
  assert.match(avionics.abl, /installed-unit records/);
});

test("multiple IFDs: two IFD550s stay two installed units and get two example USBs", () => {
  const s = M.setup(1, "multiple", true);
  assert.equal(s.aircraft[0].avionics, "2 × IFD 550");
  assert.deepEqual(plain(s.aircraft[0].usbs), ["USB A", "USB B"]);
  assert.match(M.steps(s).find((step) => step.id === "avionics").why, /two physical units/i);
  assert.match(M.steps(s).find((step) => step.id === "prepare").abl, /one USB at a time/);
  assert.match(s.notes.join(" "), /several USBs/);
});

test("Vantage beta: accepted two-IFD440 + Vantage topology is explained without overclaiming", () => {
  const s = M.setup(1, "vantage", true);
  assert.equal(s.aircraft[0].avionics, "2 × IFD 440 + Vantage");
  assert.deepEqual(plain(s.aircraft[0].usbs), ["USB A"]);
  const steps = M.steps(s);
  const vantage = steps.find((step) => step.id === "vantage");
  assert.ok(vantage);
  assert.match(vantage.summary, /one Vantage-sourced USB/);
  assert.match(vantage.why, /two IFD 440s and the Vantage PFD\/MFD/);
  assert.match(vantage.why, /not a blanket claim/i);
  assert.match(s.notes.join(" "), /Vantage beta acceptance/);
  assert.match(s.notes.join(" "), /explicitly enabled per test\/customer unit/);
});

test("two aircraft: separate aircraft, USB assignment, separation step, 11 steps", () => {
  const s = M.setup(2, "multiple", true);
  assert.deepEqual(plain(s.aircraft.map((a) => a.tail)), ["N247AP", "N81JN"]);
  assert.deepEqual(plain(s.aircraft.map((a) => a.usbs)), [["USB A"], ["USB B", "USB C"]]);
  assert.deepEqual(plain(s.aircraft.map((a) => a.coverage)), ["Southwest", "Northeast"]);
  const steps = M.steps(s);
  assert.equal(steps.length, 13);
  const usb = steps.find((step) => step.id === "usb");
  assert.deepEqual(plain(usb.see.map((i) => i.src)), ["assets/abl/card-usb-setup.png", "assets/abl/usb-manage.png",
    "assets/abl/usb-confirm.png"]);
  assert.match(usb.you, /USB SETUP REQUIRED/);
  assert.match(usb.abl, /only ever written for the aircraft that owns it/);
  assert.match(usb.abl, /USB CONFLICT/);
  assert.match(usb.ways.browser.text, /Assigning is done on the ABL/);
  assert.ok(steps.find((step) => step.id === "separate"));
  assert.match(s.notes.join(" "), /automated tests/);
});

test("step counts stay within 11–14 for every representative setup", () => {
  for (const aircraft of [1, 2]) {
    for (const avionics of Object.keys(M.AVIONICS)) {
      for (const charts of [true, false]) {
        const count = M.steps(M.setup(aircraft, avionics, charts)).length;
        assert.ok(count >= 11 && count <= 14, `${aircraft}/${avionics}/${charts}: ${count}`);
      }
    }
  }
});

test("every step says what you do, what ABL does and why", () => {
  for (const avionics of Object.keys(M.AVIONICS)) {
    for (const step of M.steps(M.setup(2, avionics, true))) {
      for (const field of ["title", "summary", "you", "abl", "why"]) assert.ok(step[field], `${step.id}.${field}`);
    }
  }
});

test("no password, percentage or live-availability claims", () => {
  const all = text([M.MESSAGES, ...[1, 2].map((n) => M.steps(M.setup(n, "mixed", true)))]);
  assert.doesNotMatch(all, /password\s*[:=]/i);
  assert.doesNotMatch(all, /\d+\s?%/);
  assert.match(all, /not a percentage/);
  assert.match(all, /never guesses cycles from the calendar/);
});

test("message reference covers the customer-facing states", () => {
  const names = M.MESSAGES.map((m) => m.name).join(" | ");
  for (const name of ["WIFI SETUP REQUIRED", "JEPPESEN LOGIN REQUIRED", "REAUTHENTICATION REQUIRED", "SELECT AIRCRAFT",
    "USB SETUP REQUIRED", "USB CONFLICT", "NOT YET AVAILABLE", "DO NOT REMOVE", "SAFE TO REMOVE"]) {
    assert.ok(names.includes(name) || text(M.MESSAGES).includes(name), name);
  }
  for (const message of M.MESSAGES) assert.ok(message.means && message.todo, message.name);
});

test("two ways to set up: only what the current product supports", () => {
  const tasks = Object.fromEntries(M.TASKS.map((t) => [t.task, t]));
  assert.match(tasks["Assign a USB to an aircraft"].browser, /^No/);
  assert.match(tasks["Load the next cycle early (LOAD NXT)"].browser, /^No/);
  assert.match(tasks["Electronic Charts coverage"].abl, /Regions/);
  assert.match(tasks["Electronic Charts coverage"].browser, /states/);
  const twoWays = M.steps(M.setup(1, "ifd500", true))[0];
  assert.equal(twoWays.id, "two-ways");
  assert.match(twoWays.why, /local only/);
  assert.match(twoWays.why, /not on the Internet/);
  assert.match(twoWays.you, /WEB SETUP/);
});

test("chart coverage: per aircraft, no password while CONNECTED, Change Account separate", () => {
  const steps = M.steps(M.setup(2, "ifd500", true));
  const charts = steps.find((step) => step.id === "charts");
  assert.match(charts.abl, /selected aircraft only/);
  assert.match(charts.abl, /CONNECTED, you are not asked for the password/);
  assert.match(charts.why, /changing N247AP never changes N81JN/);
  const jeppesen = steps.find((step) => step.id === "jeppesen");
  assert.match(jeppesen.ways.browser.text, /Change Account is a separate, deliberate step/);
});

test("LOAD NXT: available, ready to load and effective are distinct; never effective early", () => {
  const states = M.NXT.states.map((s) => s.word);
  for (const word of ["NOT YET AVAILABLE", "AVAILABLE — LOAD NXT", "CACHING", "READY TO LOAD", "EFFECTIVE"]) {
    assert.ok(states.includes(word), word);
  }
  const all = text(M.NXT);
  assert.match(all, /does not make a cycle effective early/);
  assert.match(all, /EFF OCT 1/);
  assert.match(all, /NavData and Obstacles/);
  assert.match(all, /Electronic Charts have their own cycle and are not part of this choice/);
  assert.match(all, /does not assume it exists just because the calendar/);
  assert.match(all, /browser portal does not have LOAD NXT/);
  const step = M.steps(M.setup(1, "ifd500", true)).find((s) => s.id === "load-nxt");
  assert.ok(step.nxt);
  assert.deepEqual(plain(step.see.map((i) => i.src.split("/").pop())), ["dashboard-load-nxt.png", "next-confirm.png",
    "dashboard-ready-to-load.png"]);
});

test("images: real ABL screens and browser-portal pages, captioned", () => {
  for (const step of M.steps(M.setup(2, "mixed", true))) {
    const images = [...(step.see || []), ...(step.more || []),
      ...(step.ways ? [step.ways.abl.img, step.ways.browser.img] : [])].filter(Boolean);
    for (const image of images) {
      assert.match(image.src, /^assets\/(abl|portal)\/[a-z0-9-]+\.png$/, image.src);
      assert.ok(image.caption, image.src);
    }
  }
});
