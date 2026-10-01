/* ABL User Guide — page rendering and navigation.
 *
 * Routes (hash based, so the guide works from any folder and from disk):
 *   #/                         start
 *   #/setup                    the three questions
 *   #/guide/<a>/<avionics>/<charts>/<n>   n = 0 is "Your setup", then the workflow steps
 *   #/done/<a>/<avionics>/<charts>        your configuration + message reference
 * The only state is the visitor's answers, kept in the URL.
 */
(function () {
  "use strict";
  var M = window.ABLGuideModel;
  var app = document.getElementById("app");
  var answers = { aircraft: null, avionics: null, charts: null };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function chartsQuestionApplies(a) {
    return !(answers.aircraft === 1 && a === "ifd400");
  }

  function setupKey() {
    return answers.aircraft + "/" + answers.avionics + "/" + (answers.charts ? "charts" : "nocharts");
  }

  function parseSetup(parts) {
    var aircraft = Number(parts[0]);
    var avionics = parts[1];
    var charts = parts[2] === "charts";
    var s = M.setup(aircraft, avionics, charts);
    if (s) { answers = { aircraft: aircraft, avionics: avionics, charts: charts }; }
    return s;
  }

  // ---- Images: real ABL screens and browser-portal pages (example data) -------------------------
  function shot(image, size) {
    var abl = image.kind === "abl";
    return '<figure class="shot ' + image.kind + (size ? " " + size : "") + '">' +
      '<div class="shot-frame"><img src="' + image.src + '" alt="' + esc(image.caption) + '" loading="lazy"' +
      (abl ? ' width="800" height="480"' : "") + "></div>" +
      "<figcaption>" + esc(image.caption) + "</figcaption></figure>";
  }

  function seeSection(images) {
    if (!images || !images.length) { return ""; }
    var abl = images.filter(function (i) { return i.kind === "abl"; });
    var web = images.filter(function (i) { return i.kind !== "abl"; });
    var html = "";
    if (abl.length) {
      html += '<section class="see"><h2 class="see-title">What you’ll see on the ABL</h2>' +
        shot(abl[0], "lead") + (abl.length > 1 ? '<div class="shots">' + abl.slice(1).map(function (i) { return shot(i); }).join("") + "</div>" : "") +
        "</section>";
    }
    if (web.length) {
      html += '<section class="see"><h2 class="see-title web">In your browser</h2>' + web.map(function (i) { return shot(i); }).join("") + "</section>";
    }
    return html;
  }

  function waysSection(ways) {
    if (!ways) { return ""; }
    function side(kind, title, item) {
      return '<div class="way ' + kind + '"><h3>' + title + "</h3><p>" + esc(item.text) + "</p>" + (item.img ? shot(item.img) : "") + "</div>";
    }
    return '<details class="more ways-detail" open><summary>On the ABL · In your browser</summary><div class="ways">' +
      side("on-abl", "On the ABL", ways.abl) + side("in-browser", "In your browser", ways.browser) + "</div></details>";
  }

  function tasksTable() {
    return '<div class="tasks" role="table" aria-label="Where each task can be done"><div class="task head" role="row">' +
      '<span role="columnheader">Task</span><span role="columnheader">On the ABL</span><span role="columnheader">In your browser</span></div>' +
      M.TASKS.map(function (t) {
        return '<div class="task" role="row"><span role="cell"><b>' + esc(t.task) + '</b></span><span role="cell">' + esc(t.abl) +
          '</span><span role="cell">' + esc(t.browser) + "</span></div>";
      }).join("") + "</div>";
  }

  function nxtSection() {
    var n = M.NXT;
    function rows(list) {
      return list.map(function (t) { return '<div class="term"><b>' + esc(t.word) + "</b><span>" + esc(t.meaning) + "</span></div>"; }).join("");
    }
    return '<section class="nxt"><h2 class="see-title">Current and next</h2><div class="terms">' + rows(n.terms) + "</div>" +
      '<h2 class="see-title">What NXT NAV can show</h2><div class="terms">' + rows(n.states) + "</div>" +
      '<h2 class="see-title">Example</h2><ol class="timeline">' + n.timeline.map(function (t) {
        return '<li><b>' + esc(t.when) + "</b><span>" + esc(t.text) + "</span></li>";
      }).join("") + '</ol><div class="cautions"><h2 class="see-title">Important</h2><ul>' +
      n.cautions.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div></section>";
  }

  // ---- "Your setup" diagram ------------------------------------------------------------------
  function setupDiagram(s) {
    return '<div class="setup-diagram">' + s.aircraft.map(function (a, i) {
      return '<section class="aircraft-card"><div class="ac-kicker">Aircraft ' + (i + 1) + "</div>" +
        '<div class="ac-tail">' + esc(a.tail) + "</div>" +
        '<div class="ac-row"><span>Avionics</span><b>' + esc(a.avionics) + "</b></div>" +
        '<div class="ac-row"><span>Electronic Charts</span><b>' + (a.charts ? esc(a.coverage) + " coverage" : "Not used") + "</b></div>" +
        '<div class="ac-usbs"><span>USB media</span><div>' + a.usbs.map(function (u) {
          return '<i class="usb-chip">' + esc(u) + "</i>";
        }).join("") + "</div></div></section>";
    }).join('<div class="ac-divider" aria-hidden="true">separate</div>') + "</div>";
  }

  function notesHtml(s) {
    if (!s.notes.length) { return ""; }
    return '<ul class="validation">' + s.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
  }

  // ---- Views ---------------------------------------------------------------------------------
  function viewStart() {
    return '<section class="hero"><img class="hero-art" src="assets/n247ap-scene.png" alt="Pixel-art illustration of Cessna N247AP climbing out">' +
      '<div class="hero-copy"><p class="kicker">ABL v8.2 · Interactive user guide</p><h1>ABL USER GUIDE</h1>' +
      '<p class="lead">See how ABL works with your aircraft.</p>' +
      '<p class="demo-note"><b>Demonstration only.</b> This guide is not connected to any ABL, Jeppesen account, database or USB. ' +
      "Answer three questions and it shows what you will do, what ABL does, what you will see on the ABL, and what you can do from a browser.</p>" +
      '<a class="btn primary" href="#/setup" data-test="start">Start Guide</a></div></section>';
  }

  function radio(name, value, label, checked, extra) {
    return '<label class="choice"><input type="radio" name="' + name + '" value="' + value + '"' +
      (checked ? " checked" : "") + (extra || "") + "><span>" + label + "</span></label>";
  }

  function viewQuestions() {
    var a = answers.aircraft, v = answers.avionics;
    var showCharts = v ? chartsQuestionApplies(v) : true;
    return '<section class="panel questions"><p class="kicker">Your setup</p><h1>How is your aircraft set up?</h1>' +
      '<form id="setup-form">' +
      '<fieldset><legend>How many aircraft?</legend><div class="choices two">' +
      radio("aircraft", "1", "One", a === 1) + radio("aircraft", "2", "Two", a === 2) + "</div></fieldset>" +
      '<fieldset><legend>What avionics do you have?</legend>' +
      '<p class="hint" id="two-note"' + (a === 2 ? "" : " hidden") + '>With two aircraft, the guide shows N247AP with one IFD500 ' +
      "and N81JN with the avionics you choose here.</p>" + '<div class="choices">' +
      radio("avionics", "ifd400", "IFD400", v === "ifd400") + radio("avionics", "ifd500", "IFD500", v === "ifd500") +
      radio("avionics", "mixed", "IFD500 + IFD400", v === "mixed") + radio("avionics", "multiple", "Multiple IFDs <small>(two IFD500s)</small>", v === "multiple") +
      "</div></fieldset>" +
      '<fieldset id="charts-q"' + (showCharts ? "" : " hidden") + '><legend>Do you use Electronic Charts?</legend><div class="choices two">' +
      radio("charts", "yes", "Yes", answers.charts === true) + radio("charts", "no", "No", answers.charts === false) +
      "</div></fieldset>" +
      '<p class="hint" id="charts-hint"' + (showCharts ? " hidden" : "") + ">An IFD400 does not use Electronic Charts, so there is nothing to choose.</p>" +
      '<div class="nav"><a class="btn ghost" href="#/">← Back</a><button class="btn primary" type="submit" id="setup-go" data-test="show-workflow">Show my workflow →</button></div>' +
      "</form></section>";
  }

  function stepNav(key, index, total) {
    var back = index === 0 ? "#/setup" : "#/guide/" + key + "/" + (index - 1);
    var next = index >= total ? "#/done/" + key : "#/guide/" + key + "/" + (index + 1);
    return '<nav class="nav" aria-label="Guide navigation"><a class="btn ghost" href="' + back + '" data-test="back">← Back</a>' +
      '<a class="btn ghost small" href="#/" data-test="start-over">Start over</a>' +
      '<a class="btn primary" href="' + next + '" data-test="next">' + (index >= total ? "Finish →" : "Next →") + "</a></nav>";
  }

  function viewGuide(s, index) {
    var key = setupKey();
    var steps = M.steps(s);
    var total = steps.length;
    index = Math.max(0, Math.min(total, index));
    var progress = '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + index +
      '"><i style="width:' + Math.round(index / total * 100) + '%"></i></div>';
    if (index === 0) {
      return '<section class="panel">' + progress + '<p class="kicker">Your setup</p><h1 id="step-title">Here is your setup</h1>' +
        '<p class="lead-sm">ABL keeps everything per aircraft: its avionics, its chart coverage and the USB drives that belong to it.</p>' +
        setupDiagram(s) + notesHtml(s) +
        '<p class="hint">Next: ' + total + ' short steps from unboxing to loading your avionics. Each step can be skimmed, ' +
        "or opened for more detail.</p>" + stepNav(key, 0, total) + "</section>";
    }
    var st = steps[index - 1];
    return '<section class="panel step" data-step="' + st.id + '">' + progress +
      '<p class="kicker">Step ' + index + " of " + total + '</p><h1 id="step-title">' + esc(st.title) + "</h1>" +
      '<p class="summary">' + esc(st.summary) + "</p>" +
      (st.tasks ? tasksTable() : "") +
      (st.nxt ? nxtSection() : "") +
      seeSection(st.see) +
      '<div class="details">' +
      '<details class="more you" open><summary>What you do</summary><p>' + esc(st.you) + "</p></details>" +
      '<details class="more abl"><summary>What ABL does</summary><p>' + esc(st.abl) + "</p></details>" +
      '<details class="more why"><summary>Why this matters</summary><p>' + esc(st.why) + "</p></details>" +
      waysSection(st.ways) +
      (st.more && st.more.length ? '<details class="more learn"><summary>Learn more</summary>' +
        st.more.map(function (i) { return shot(i); }).join("") + "</details>" : "") +
      "</div>" + stepNav(key, index, total) + "</section>";
  }

  function viewDone(s) {
    var key = setupKey();
    var total = M.steps(s).length;
    return '<section class="panel"><p class="kicker">Summary</p><h1 id="step-title">Your configuration</h1>' +
      '<p class="lead-sm">Aircraft: ' + s.aircraft.length + "</p>" + setupDiagram(s) + notesHtml(s) +
      '<h2 class="section-title">Messages you may see on ABL</h2><div class="messages">' + M.MESSAGES.map(function (m) {
        return '<div class="message"><b>' + esc(m.name) + "</b><p>" + esc(m.means) + '</p><p class="todo">' + esc(m.todo) + "</p></div>";
      }).join("") + "</div>" +
      '<nav class="nav"><a class="btn ghost" href="#/guide/' + key + "/" + total + '" data-test="back">← Back</a>' +
      '<a class="btn primary" href="#/" data-test="start-over">Start over</a></nav></section>';
  }

  // ---- Router --------------------------------------------------------------------------------
  function render() {
    var hash = location.hash || "#/";
    var parts = hash.replace(/^#\/?/, "").split("/");
    var html;
    if (parts[0] === "setup") {
      html = viewQuestions();
    } else if (parts[0] === "guide" || parts[0] === "done") {
      var s = parseSetup(parts.slice(1, 4));
      if (!s) { location.hash = "#/setup"; return; }
      html = parts[0] === "done" ? viewDone(s) : viewGuide(s, Number(parts[4]) || 0);
    } else {
      answers = { aircraft: null, avionics: null, charts: null };     // Start over clears the answers
      html = viewStart();
    }
    app.innerHTML = html;
    bind();
    var title = document.getElementById("step-title") || app.querySelector("h1");
    if (title && render.started) { title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    render.started = true;
  }

  function bind() {
    var form = document.getElementById("setup-form");
    if (!form) { return; }
    var go = document.getElementById("setup-go");
    function sync() {
      var data = new FormData(form);
      answers.aircraft = data.get("aircraft") ? Number(data.get("aircraft")) : null;
      answers.avionics = data.get("avionics") || null;
      document.getElementById("two-note").hidden = answers.aircraft !== 2;
      var applies = answers.avionics ? chartsQuestionApplies(answers.avionics) : true;
      document.getElementById("charts-q").hidden = !applies;
      document.getElementById("charts-hint").hidden = applies || !answers.avionics;
      answers.charts = applies ? (data.get("charts") ? data.get("charts") === "yes" : null) : false;
      go.disabled = !(answers.aircraft && answers.avionics && answers.charts !== null);
    }
    form.addEventListener("change", sync);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      sync();
      if (!go.disabled) { location.hash = "#/guide/" + setupKey() + "/0"; }
    });
    sync();
  }

  window.addEventListener("hashchange", render);
  window.ABLGuide = { render: render, answers: function () { return answers; } };   // used by the browser self-test
  render();
})();
