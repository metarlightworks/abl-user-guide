/* In-page self-test, injected into a temporary copy of dist/index.html by run.mjs.
 * Drives the real guide through every representative setup and checks content and layout
 * at the current viewport. Results are written to <pre id="selftest-results">. */
(function () {
  "use strict";
  var results = [];
  var app = document.getElementById("app");
  function check(name, ok, detail) { results.push({ name: name, ok: Boolean(ok), detail: ok ? "" : String(detail || "") }); }
  function $(selector) { return document.querySelector(selector); }
  function $$(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function go(hash) { history.replaceState(null, "", hash); window.ABLGuide.render(); }
  function text() { return app.textContent.replace(/\s+/g, " "); }
  function layout(label) {
    var overflow = document.documentElement.scrollWidth - window.innerWidth;
    check(label + ": no horizontal scrolling", overflow <= 1, overflow + "px");
    var small = $$(".btn, .choice span, details.more > summary").filter(function (el) {
      return el.offsetParent !== null && el.getBoundingClientRect().height < 44;
    });
    var unlabeled = $$("img").filter(function (img) { return !img.getAttribute("alt"); });
    check(label + ": every image has a description", unlabeled.length === 0, unlabeled.length);
    check(label + ": touch targets at least 44px tall", small.length === 0,
      small.map(function (el) { return el.textContent.trim(); }).join(", "));
  }
  function choose(name, value) {
    var input = $('input[name="' + name + '"][value="' + value + '"]');
    input.click();
  }

  try {
    // Start
    go("#/");
    check("start: title", $("h1").textContent === "ABL USER GUIDE");
    check("start: demonstration notice", /Demonstration only/.test(text()) && /DEMONSTRATION/.test(document.body.textContent));
    check("start: Start Guide goes to the questions", $('[data-test="start"]').getAttribute("href") === "#/setup");
    layout("start");

    // Questions
    go("#/setup");
    check("questions: continue disabled until answered", $("#setup-go").disabled);
    choose("aircraft", "1"); choose("avionics", "ifd400");
    check("questions: charts hidden for one IFD400", $("#charts-q").hidden && !$("#charts-hint").hidden);
    check("questions: IFD400 can continue without a charts answer", !$("#setup-go").disabled);
    choose("avionics", "ifd500");
    check("questions: charts asked for IFD500", !$("#charts-q").hidden && $("#setup-go").disabled);
    choose("charts", "yes");
    $("#setup-go").click();
    check("questions: submit opens the workflow", location.hash === "#/guide/1/ifd500/charts/0", location.hash);
    layout("questions");

    // Every representative setup, walked end to end with Next.
    var setups = [];
    [1, 2].forEach(function (aircraft) {
      ["ifd400", "ifd500", "mixed", "multiple"].forEach(function (avionics) {
        setups.push(aircraft + "/" + avionics + "/charts");
      });
    });
    setups.push("1/ifd500/nocharts");
    setups.forEach(function (key) {
      go("#/guide/" + key + "/0");
      check(key + ": setup diagram", $(".setup-diagram") && /N247AP|N81JN/.test(text()), text().slice(0, 80));
      layout(key + " setup");
      var total = null, index = 0, seen = [];
      for (var guard = 0; guard < 20; guard += 1) {
        var next = $('[data-test="next"]').getAttribute("href");
        if (next.indexOf("#/done/") === 0) { break; }
        go(next);
        index += 1;
        var kicker = $(".kicker").textContent;
        var match = /Step (\d+) of (\d+)/.exec(kicker);
        check(key + " step " + index + ": numbered", match && Number(match[1]) === index, kicker);
        total = match ? Number(match[2]) : total;
        seen.push($(".step").getAttribute("data-step"));
        var sections = $$("details.more > summary").map(function (el) { return el.textContent; });
        check(key + " step " + index + ": what you do / what ABL does / why this matters",
          sections.indexOf("What you do") === 0 && sections.indexOf("What ABL does") > 0 && sections.indexOf("Why this matters") > 0,
          sections.join(","));
        check(key + " step " + index + ": skim summary and 'What you do' open", $(".summary") && $("details.more.you").open);
        var ablShots = $$(".shot.abl").length;
        check(key + " step " + index + ": ABL screens labelled 'What you'll see on the ABL'",
          !ablShots || /What you’ll see on the ABL/.test(text()));
        check(key + " step " + index + ": images captioned", $$(".shot").every(function (f) { return f.querySelector("figcaption").textContent.length > 5; }));
        check(key + " step " + index + ": back goes one step back",
          $('[data-test="back"]').getAttribute("href") === "#/guide/" + key + "/" + (index - 1));
        layout(key + " step " + index);
        var id = seen[seen.length - 1];
        function hasImage(name) { return Boolean($('img[src="assets/abl/' + name + '.png"]')); }
        if (id === "two-ways") {
          check(key + ": two ways table", $$(".task").length === 8 && /local only/.test(text()) && hasImage("web-setup-address"));
        }
        if (id === "prepare") { check(key + ": real writing screen", hasImage("dashboard-writing")); }
        if (id === "ready") { check(key + ": real ready screen", hasImage("dashboard-ready")); }
        if (id === "usb" && key.charAt(0) === "2") {
          check(key + ": USB setup screens", hasImage("card-usb-setup") && hasImage("usb-confirm") && /USB SETUP REQUIRED/.test(text()));
        }
        if (id === "charts" && /charts$/.test(key) && key.indexOf("1/ifd400") !== 0) {
          check(key + ": charts on the ABL and in the browser", hasImage("chart-coverage") &&
            Boolean($('img[src="assets/portal/portal-charts.png"]')) && $(".ways-detail").open);
        }
        if (id === "load-nxt") {
          check(key + ": LOAD NXT explanation", $$(".timeline li").length === 4 && /does not make a cycle effective early/.test(text()) &&
            /READY TO LOAD/.test(text()) && /EFFECTIVE/.test(text()) && hasImage("next-confirm"));
        }
      }
      check(key + ": 11 to 13 steps", total >= 11 && total <= 13 && index === total, index + "/" + total);
      check(key + ": two aircraft get the separation step", (key.charAt(0) === "2") === (seen.indexOf("separate") >= 0));
      check(key + ": IFD400-only has no chart coverage picker",
        key !== "1/ifd400/charts" || !/Choose Electronic Charts coverage/.test(seen.join()));
      go("#/done/" + key);
      check(key + ": summary", /Your configuration/.test(text()) && $$(".message").length === 9);
      layout(key + " summary");
    });

    // Back to the questions keeps the answers; Start over clears them.
    go("#/guide/2/mixed/charts/0");
    go($('[data-test="back"]').getAttribute("href"));
    check("back keeps answers", $('input[name="aircraft"][value="2"]').checked && $('input[name="avionics"][value="mixed"]').checked &&
      $('input[name="charts"][value="yes"]').checked);
    go("#/guide/2/mixed/charts/3");
    check("start over link", $('[data-test="start-over"]').getAttribute("href") === "#/");
    go("#/");
    check("start over clears answers", window.ABLGuide.answers().aircraft === null);
    go("#/setup");
    check("start over: questions empty", !$$("input:checked").length);

    // Unknown setups fall back to the questions.
    go("#/guide/3/vantage/charts/0");
    check("invalid setup returns to the questions", location.hash === "#/setup", location.hash);
  } catch (error) {
    check("self-test completed without errors", false, error && error.stack || error);
  }

  var output = document.createElement("pre");
  output.id = "selftest-results";
  output.textContent = JSON.stringify({ viewport: [window.innerWidth, window.innerHeight], results: results });
  document.body.appendChild(output);
})();
