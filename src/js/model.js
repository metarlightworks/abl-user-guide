/* ABL User Guide — representative setups and the workflow steps for each.
 *
 * Pure data and small functions (no DOM), shared by the page and the Node tests.
 * Everything is illustrative: no ABL, Jeppesen account, database or USB is involved.
 */
(function (root) {
  "use strict";

  // The owner's aircraft, used as example registrations only.
  var TAILS = ["N247AP", "N81JN"];

  var AVIONICS = {
    ifd400: { label: "IFD 440", panel: [{ family: "IFD400", model: "IFD 440", count: 1 }] },
    ifd500: { label: "IFD 550", panel: [{ family: "IFD500", model: "IFD 550", count: 1 }] },
    mixed: { label: "IFD 550 + IFD 440", panel: [{ family: "IFD500", model: "IFD 550", count: 1 },
                                                  { family: "IFD400", model: "IFD 440", count: 1 }] },
    multiple: { label: "Two IFD 550s", panel: [{ family: "IFD500", model: "IFD 550", count: 2 }] },
    vantage: { label: "Vantage + two IFD 440s", panel: [{ family: "IFD400", model: "IFD 440", count: 2 },
                                                        { family: "VANTAGE", model: "Vantage", count: 1 }] }
  };

  function panelText(panel) {
    return panel.map(function (item) {
      return (item.count > 1 ? item.count + " × " : "") + (item.model || item.family);
    }).join(" + ");
  }

  function chartsPossible(panel) {
    return panel.some(function (item) { return item.family === "IFD500" || item.family === "VANTAGE"; });
  }

  /* A representative setup for the visitor's answers.
   * - USB/media needs come from the current package planner, not from installed-unit quantity.
   * - With two aircraft, N247AP remains the simple IFD550 example and N81JN uses the chosen cockpit.
   * - Electronic Charts apply to IFD500-series and Vantage when the Jeppesen entitlement provides them.
   * - The Vantage example is the physically accepted two-IFD440 + Vantage beta topology. */
  function setup(aircraftCount, avionicsKey, wantsCharts) {
    var choice = AVIONICS[avionicsKey];
    if (!choice || (aircraftCount !== 1 && aircraftCount !== 2)) { return null; }
    var letters = ["USB A", "USB B", "USB C"];
    var next = 0;
    function usbsFor(panel) {
      var count = panel.reduce(function (n, item) { return n + item.count; }, 0) > 1 && avionicsKey === "multiple" ? 2 : 1;
      var list = letters.slice(next, next + count);
      next += count;
      return list;
    }
    var panels = aircraftCount === 1 ? [choice.panel] : [AVIONICS.ifd500.panel, choice.panel];
    var aircraft = panels.map(function (panel, index) {
      var charts = Boolean(wantsCharts) && chartsPossible(panel);
      return { tail: TAILS[index], avionics: panelText(panel), panel: panel,
               charts: charts, coverage: charts ? (index === 0 ? "Southwest" : "Northeast") : "", usbs: usbsFor(panel) };
    });
    return { aircraftCount: aircraftCount, avionicsKey: avionicsKey, wantsCharts: Boolean(wantsCharts),
             aircraft: aircraft, notes: validationNotes(aircraft) };
  }

  // What has and has not been physically proven yet, so the guide never overclaims.
  function validationNotes(aircraft) {
    var notes = [];
    var only500 = aircraft.every(function (a) { return a.panel.every(function (i) { return i.family === "IFD500"; }); });
    var hasVantage = aircraft.some(function (a) { return a.panel.some(function (i) { return i.family === "VANTAGE"; }); });
    var hasStandalone400 = aircraft.some(function (a) {
      return a.panel.some(function (i) { return i.family === "IFD400"; }) &&
             !a.panel.some(function (i) { return i.family === "VANTAGE"; });
    });
    if (aircraft.length === 1 && aircraft[0].usbs.length === 1 && only500) {
      notes.push("Physically verified: an ABL-prepared USB loaded NavData, Obstacles and Electronic Charts into an Avidyne IFD550.");
    }
    if (hasVantage) {
      notes.push("Vantage beta acceptance: one ABL-created Vantage bundle USB was accepted on a Cirrus installation with two IFD440s and Vantage PFD/MFD. Vantage writing remains explicitly enabled per test/customer unit; an entitlement alone does not enable it.");
    }
    if (hasStandalone400) {
      notes.push("The standalone IFD400-package workflow remains in physical validation; the accepted Vantage + IFD440 topology uses the Vantage-sourced bundle.");
    }
    if (aircraft.some(function (a) { return a.usbs.length > 1; })) {
      notes.push("Preparing several USBs for one aircraft is supported; validation with several USBs inserted at once is still in progress.");
    }
    if (aircraft.length > 1) {
      notes.push("Keeping aircraft and their USBs separate is covered by ABL's automated tests; physical two-aircraft validation is still in progress.");
    }
    return notes;
  }

  function listTails(aircraft) {
    return aircraft.map(function (a) { return a.tail; }).join(" and ");
  }

  // Real ABL / browser-portal images (rendered from the current ABL 8.3.0-rc.1 code with demo data).
  function abl(name, caption) { return { kind: "abl", src: "assets/abl/" + name + ".png", caption: caption }; }
  function portal(name, caption) { return { kind: "portal", src: "assets/portal/" + name + ".png", caption: caption }; }

  /* Where a task can be done. Only what the current product supports:
   * browser portal = the ABL's own local web page (same network only, no Internet access). */
  var TASKS = [
    { task: "Wi-Fi", abl: "SETTINGS → NETWORK", browser: "Yes" },
    { task: "Jeppesen sign-in and account", abl: "SETTINGS → JEPPESEN", browser: "Yes — shows CONNECTED; Change Account" },
    { task: "Cockpit Setup — installed equipment and quantities", abl: "SETTINGS → AIRCRAFT → COCKPIT SETUP", browser: "Yes — same cockpit model, review and save" },
    { task: "Electronic Charts coverage", abl: "Regions: MENU → CHART COVERAGE", browser: "Regions, individual states, an area drawn on a map, minimum runway length" },
    { task: "Assign a USB to an aircraft", abl: "MENU → USB / MEDIA → MANAGE USB", browser: "No (you can clear an aircraft's USB assignments)" },
    { task: "Name or format a USB", abl: "MENU → USB / MEDIA", browser: "No" },
    { task: "Load the next cycle early (LOAD NXT)", abl: "Tap NXT NAV on the dashboard", browser: "No" }
  ];

  /* The workflow for a setup: 11–14 steps. Each step has a one-line summary for skimming and
   * expandable detail: what you do, what ABL does, why it matters, what you'll see, and where both
   * apply, how to do it on the ABL and in your browser. */
  function steps(s) {
    var two = s.aircraft.length > 1;
    var first = s.aircraft[0];
    var last = s.aircraft[s.aircraft.length - 1];
    var anyCharts = s.aircraft.some(function (a) { return a.charts; });
    var usbTotal = s.aircraft.reduce(function (n, a) { return n + a.usbs.length; }, 0);
    var multiUsb = s.aircraft.some(function (a) { return a.usbs.length > 1; });
    var plural = usbTotal > 1;
    var result = [];

    result.push({ id: "two-ways", title: "Two ways to set up your ABL",
      summary: "Most setup can be done on the ABL touchscreen or from a browser on your phone, tablet or computer.",
      you: "Use whichever is easier. ON THE ABL: tap MENU, or tap an instruction card on the screen — it takes you " +
           "straight to the right page. IN YOUR BROWSER: on the ABL open MENU → SETTINGS → WEB SETUP (or hold the ABL " +
           "logo). It shows the address of ABL's setup portal, for example http://abl.local. Open it on a device " +
           "connected to the same Wi-Fi as your ABL.",
      abl: "Serves its own setup portal on your local network. No app, no extra account and no password are needed " +
           "on the same Wi-Fi.",
      why: "You don't have to stand in front of the ABL for every setup change. The portal is local only: it is not on " +
           "the Internet and cannot be reached from outside your network.",
      tasks: true,
      see: [abl("menu-settings", "SETTINGS on the ABL: Network, Jeppesen, Aircraft and Web Setup."),
            abl("web-setup-address", "WEB SETUP shows the portal address (examples shown).")] });

    result.push({ id: "wifi", title: "Connect ABL to Wi-Fi",
      summary: "ABL needs Internet access through your hangar Wi-Fi to download databases.",
      you: "Plug ABL in. The first time, it shows WIFI SETUP REQUIRED and starts its own setup Wi-Fi network " +
           "(name and password are on the screen). Choose your hangar Wi-Fi from your phone, or on the touchscreen.",
      abl: "Connects to your hangar Wi-Fi and leaves setup mode.",
      why: "ABL downloads databases directly from Jeppesen, so it needs Internet access.",
      see: [abl("card-wifi", "First start: the card is a shortcut to Wi-Fi setup.")],
      ways: { abl: { text: "Tap the WIFI SETUP REQUIRED card, or MENU → SETTINGS → NETWORK, and use the on-screen keyboard.", img: null },
              browser: { text: "Join the ABL's setup Wi-Fi with your phone, open http://10.42.0.1 and choose your hangar network. Later you can change Wi-Fi from the portal.",
                         img: portal("portal-wifi", "Choosing the hangar network in the browser portal.") } } });

    result.push({ id: "jeppesen", title: "Sign in to Jeppesen",
      summary: "ABL uses your Jeppesen account to find your aircraft, subscriptions and databases.",
      you: "Sign in once with your Jeppesen email and password.",
      abl: "Checks the account with Jeppesen before saving it, then shows CONNECTED. It does not ask for the " +
           "password again unless Jeppesen stops accepting it (REAUTHENTICATION REQUIRED) or you choose Change Account.",
      why: "Your Jeppesen subscriptions say which aircraft and databases you are entitled to. ABL only uses what your " +
           "account provides.",
      see: [abl("card-jeppesen", "Before sign-in: the card goes straight to Jeppesen sign-in.")],
      ways: { abl: { text: "Tap the JEPPESEN LOGIN REQUIRED card, or MENU → SETTINGS → JEPPESEN.", img: null },
              browser: { text: "The Jeppesen account section shows CONNECTED with the saved account. Change Account is a separate, deliberate step; the saved password is never shown.",
                         img: portal("portal-jeppesen-connected", "Signed in: CONNECTED, with Change Account.") } },
      more: [portal("portal-jeppesen-reauth", "If Jeppesen no longer accepts the saved sign-in, the portal says so and asks you to sign in again.")] });

    result.push({ id: "aircraft", title: "Select your aircraft",
      summary: two ? "Choose each aircraft ABL should update: " + listTails(s.aircraft) + "."
                   : "Choose " + first.tail + " from the aircraft in your Jeppesen account.",
      you: two ? "Choose " + listTails(s.aircraft) + ". (The beta manages up to three aircraft automatically.)"
               : "Choose " + first.tail + ". If your account has exactly one aircraft with one set of services, ABL selects it for you.",
      abl: "Lists the aircraft registered in your Jeppesen subscriptions.",
      why: "ABL keeps databases, chart coverage and USBs per aircraft, so aircraft never mix their data.",
      see: [abl("card-select-aircraft", "No aircraft chosen yet: tap the card."),
            abl("aircraft-list", "The aircraft from your Jeppesen account.")],
      ways: { abl: { text: "Tap the SELECT AIRCRAFT card, or MENU → SETTINGS → AIRCRAFT.", img: null },
              browser: { text: "Open Select Aircraft / Services in the portal.", img: portal("portal-aircraft", "Configured aircraft and their services in the portal.") } } });

    result.push({ id: "avionics", title: "Cockpit Setup — tell ABL what is actually installed",
      summary: "ABL now separates what your Jeppesen account is entitled to from the physical equipment in the cockpit.",
      you: "Open Cockpit Setup for the aircraft and set the quantity of each installed model" +
           (two ? " (" + s.aircraft.map(function (a) { return a.tail + ": " + a.avionics; }).join("; ") + ")."
                : " (" + first.avionics + ").") +
           " Leave equipment you do not have at 0, review the cockpit, then SAVE COCKPIT.",
      abl: "Shows only supported choices backed by that aircraft's Jeppesen entitlements. It expands quantities into individual installed-unit records, shows the databases ABL will manage, and uses the same saved cockpit on the touchscreen and browser portal.",
      why: s.avionicsKey === "vantage"
        ? "A Jeppesen Vantage entitlement does not prove Vantage is installed. Cockpit Setup records the real installation: two IFD 440s plus Vantage in this example. Vantage automatic writing is still explicitly enabled per beta/test unit."
        : s.avionicsKey === "multiple"
          ? "Two identical IFDs stay as two physical units even when they use the same database source. Installed-unit count and USB count are separate decisions."
          : s.avionicsKey === "mixed"
            ? "The cockpit record keeps the IFD 550 and IFD 440 as separate installed units while ABL's package planner decides the proven media arrangement."
            : "This prevents extra Jeppesen services from silently becoming equipment ABL thinks is installed.",
      see: [abl("cockpit-setup", "COCKPIT SETUP: entitlement-backed choices with installed quantities."),
            abl("cockpit-review", "Review the physical cockpit and database coverage before saving.")],
      ways: { abl: { text: "MENU → SETTINGS → AIRCRAFT → choose the aircraft → COCKPIT SETUP. Set quantities, REVIEW, then SAVE COCKPIT.", img: null },
              browser: { text: "Open the aircraft in the local portal, choose Cockpit Setup, set installed quantities, review, and save. Both surfaces use the same cockpit configuration.",
                         img: portal("portal-cockpit", "Cockpit Setup in the browser portal.") } } });

    if (s.avionicsKey === "vantage") {
      result.push({ id: "vantage", title: "Vantage beta: one proven bundle for Vantage + IFD 440s",
        summary: "The accepted beta topology uses one Vantage-sourced USB for the Vantage displays and two IFD 440s.",
        you: "Use the Vantage-enabled ABL unit and the USB assigned to this aircraft. Do not assume other mixed Vantage topologies use the same media plan.",
        abl: "For the supported Vantage + IFD400-series topology, the Vantage-sourced NavData/Obstacles bundle can serve the IFD 440s as well as Vantage; Vantage Electronic Charts remain part of the Vantage package when entitled.",
        why: "This exact topology has real-aircraft acceptance evidence: an ABL-created Vantage bundle USB was accepted by two IFD 440s and the Vantage PFD/MFD. That is not a blanket claim for Vantage + IFD500 or every Vantage installation.",
        see: [abl("cockpit-setup-vantage", "Cockpit Setup: two IFD 440s and Vantage selected from the entitlement-backed choices."),
              abl("cockpit-review-vantage", "Review before saving: two IFD 440s and Vantage.")],
        more: [portal("portal-cockpit-vantage", "The same Vantage + IFD 440 cockpit shown in the local browser portal.")] });
    }

    if (anyCharts) {
      result.push({ id: "charts", title: "Choose Electronic Charts coverage",
        summary: "Pick the area your charts cover. Each aircraft has its own coverage.",
        you: "Choose full coverage or a region (for example " + first.coverage + ")" +
             ", then save. In the browser you can also choose individual states, draw an area on a map, or set a minimum runway length.",
        abl: "Saves the coverage for the selected aircraft only and prepares exactly that coverage on future updates. " +
             "Changing coverage in the browser uses the Jeppesen account already saved on the ABL: while it shows " +
             "CONNECTED, you are not asked for the password.",
        why: "A smaller area makes a smaller chart package. Coverage stays with its aircraft" +
             (two ? ": changing " + first.tail + " never changes " + last.tail + "." : "."),
        see: [abl("chart-coverage", "CHART COVERAGE on the ABL: regions per aircraft.")],
        ways: { abl: { text: "MENU → CHART COVERAGE: choose the aircraft and a region, then SAVE.", img: null },
                browser: { text: "Choose the aircraft tab, then a region, states or a map area, and tap Save Chart Coverage for that aircraft.",
                           img: portal("portal-charts", "Coverage saved for N247AP — no password needed.") } } });
    } else if (s.wantsCharts) {
      result.push({ id: "charts", title: "Electronic Charts",
        summary: "An IFD 440 does not use Electronic Charts.",
        you: "Nothing to choose for an IFD 440.", abl: "Prepares NavData and Obstacles.",
        why: "Electronic Charts are displayed by IFD500-series navigators and Vantage when entitled.", see: [] });
    }

    result.push({ id: "usb", title: two ? "Assign each USB to its aircraft" : "Your USB" + (multiUsb ? "s belong" : " belongs") + " to " + first.tail,
      summary: two ? "Tell ABL once which aircraft owns each USB. It remembers."
                   : "With one aircraft there is nothing to assign.",
      you: two ? "Insert a new USB. ABL shows USB SETUP REQUIRED; tap it, pick the USB and confirm the aircraft. Repeat " +
                 "for each USB (" + s.aircraft.map(function (a) { return a.tail + ": " + a.usbs.join(", "); }).join("; ") + ")."
               : "Insert " + (multiUsb ? "your USBs" : "a USB") + ". Any suitable USB belongs to " + first.tail + " automatically.",
      abl: two ? "Remembers which aircraft owns each USB and reuses it every time. A USB is only ever written for the " +
                 "aircraft that owns it; if one USB were ever saved to two aircraft, ABL shows USB CONFLICT and writes nothing."
               : "Uses every inserted USB for " + first.tail + (multiUsb ? "; each one gets the same databases." : "."),
      why: "An aircraft can own any number of USBs, and every one receives the same aircraft package. You can also " +
           "name or format a USB from MENU → USB / MEDIA.",
      see: two ? [abl("card-usb-setup", "A USB needs an owner: tap the card."),
                  abl("usb-manage", "Pick the USB…"), abl("usb-confirm", "…and confirm the aircraft.")]
               : [],
      ways: two ? { abl: { text: "Tap USB SETUP REQUIRED, or MENU → USB / MEDIA → MANAGE USB.", img: null },
                    browser: { text: "Assigning is done on the ABL, where the USB is plugged in. The portal can clear an aircraft's USB assignments.", img: null } }
                : null });

    if (two) {
      result.push({ id: "separate", title: "Two aircraft stay separate",
        summary: "Tap an aircraft's tab to see its own databases, USBs and status.",
        you: "Tap " + first.tail + " or " + last.tail + " at the top of the dashboard.",
        abl: "Keeps each aircraft's avionics, chart coverage, USBs and status separate. Looking at or updating one " +
             "aircraft never changes the other.",
        why: "Each USB carries only its own aircraft's databases.",
        see: [abl("dashboard-two-aircraft", "Aircraft tabs across the top of the dashboard.")] });
    }

    result.push({ id: "check", title: "ABL checks for new databases",
      summary: "Automatic. The dashboard shows what is current and what comes next.",
      you: "Nothing. Read the dashboard: CURRENT NAV is the cycle in effect now; NXT NAV is the next one, with its " +
           "effective date (EFF). " + (anyCharts ? "The chart cells show the current and next Electronic Charts. " : ""),
      abl: "Checks Jeppesen on a schedule, downloads new databases and verifies a local copy before any USB is written.",
      why: "Every USB is written from the same checked copy. ABL never guesses cycles from the calendar: NXT shows NOT " +
           "YET AVAILABLE until Jeppesen releases the next cycle.",
      see: [abl("dashboard", "The dashboard (example cycles)."), abl("dashboard-checking", "While ABL checks Jeppesen.")] });

    result.push({ id: "prepare", title: "ABL prepares the USB" + (plural ? "s" : ""),
      summary: "Insert the USB" + (plural ? "s" : "") + " and wait. Don't remove " + (plural ? "them" : "it") + " while ABL is working.",
      you: "Insert the USB" + (plural ? "s" : "") + " and leave " + (plural ? "them" : "it") + " alone.",
      abl: "Writes the aircraft's databases, then verifies them" + (plural ? ", one USB at a time" : "") + ". The " +
           "banner names the aircraft and what ABL is doing; the moving bar shows it is working (it is not a percentage).",
      why: "Removing a USB while ABL is writing or verifying it could leave the update incomplete.",
      see: [abl("dashboard-writing", "USB IN USE — DO NOT REMOVE.")] });

    result.push({ id: "ready", title: "Wait for SAFE TO REMOVE",
      summary: "USB MEDIA READY · SAFE TO REMOVE means you can take the USB" + (plural ? "s" : "") + ".",
      you: "Remove the USB" + (plural ? "s" : "") + ".",
      abl: "Only shows this after every USB was written, verified and safely unmounted.",
      why: "SAFE TO REMOVE means ABL has completely finished with the USB.",
      see: [abl("dashboard-ready", "USB MEDIA READY · SAFE TO REMOVE.")] });

    result.push({ id: "avionics-load", title: "Put the USB in the avionics",
      summary: "Load the USB at the aircraft using Avidyne's procedure.",
      you: "At the aircraft, load the USB using Avidyne's database update procedure for your IFD.",
      abl: "Nothing further — ABL's job was preparing and verifying the USB.",
      why: "ABL prepares media; loading it into the IFD is done at the aircraft, as with any Avidyne database USB.",
      see: [] });

    result.push({ id: "load-nxt", title: "Getting the next cycle early (LOAD NXT)",
      summary: "When Jeppesen releases the next NavData and Obstacles before they take effect, you can have ABL prepare them ahead of time.",
      you: "Optional. Tap the NXT NAV cell when it shows LOAD NXT, then PREPARE. Insert a USB when NXT shows READY TO LOAD.",
      abl: "Downloads and verifies the next NavData and Obstacles, writes them to the USB, verifies it and shows SAFE TO " +
           "REMOVE. The NXT NAV cell keeps showing the effective date.",
      why: "Convenience: the USB can be ready the evening before rather than prepared on the morning of a flight, or " +
           "before a trip that crosses the cycle change.",
      nxt: true,
      see: [abl("dashboard-load-nxt", "Released by Jeppesen: NXT NAV 2610 · EFF OCT 1 · LOAD NXT."),
            abl("next-confirm", "Tap NXT NAV: ABL confirms NAVDATA AND OBSTACLES 2610."),
            abl("dashboard-ready-to-load", "Downloaded and verified: READY TO LOAD — insert a USB.")] });

    return result;
  }

  // The LOAD NXT explanation (shown in the LOAD NXT step).
  var NXT = {
    terms: [
      { word: "CURRENT NAV", meaning: "The database cycle in effect now." },
      { word: "NXT NAV", meaning: "The next cycle. ABL shows its effective date under it (for example EFF OCT 1)." }
    ],
    states: [
      { word: "NOT YET AVAILABLE", meaning: "Jeppesen has not released the next cycle to your account yet. ABL does not assume it exists just because the calendar says a new cycle is due." },
      { word: "AVAILABLE — LOAD NXT", meaning: "Jeppesen has released it. Nothing is downloaded until you ask." },
      { word: "CACHING", meaning: "ABL is downloading and verifying it." },
      { word: "READY TO LOAD", meaning: "ABL has downloaded and verified it. Insert a USB and ABL prepares it." },
      { word: "EFFECTIVE", meaning: "The published effective date has arrived. From that date the cycle shows as CURRENT NAV and normal automatic updates use it." }
    ],
    timeline: [
      { when: "Sep 30", text: "CURRENT NAV is 2609. NXT NAV shows 2610 · EFF OCT 1 · LOAD NXT: Jeppesen has released 2610, and it becomes effective on October 1." },
      { when: "Sep 30, evening", text: "You fly early tomorrow. You tap NXT NAV; ABL asks PREPARE NXT CYCLE EARLY? — NAVDATA AND OBSTACLES 2610. You tap PREPARE." },
      { when: "Sep 30, evening", text: "ABL downloads and verifies 2610 (CACHING, then READY TO LOAD), writes it to the USB you insert, verifies it and shows SAFE TO REMOVE. NXT NAV still shows EFF OCT 1." },
      { when: "Oct 1", text: "2610 becomes effective and moves to CURRENT NAV. ABL carries on with normal automatic updates." }
    ],
    cautions: [
      "Loading early does not make a cycle effective early. 2610 takes effect on its published effective date (October 1). Check the dates on your IFD and follow Avidyne's guidance for loading a database before its effective date.",
      "LOAD NXT is for NavData and Obstacles — the confirmation screen says so. Electronic Charts have their own cycle and are not part of this choice.",
      "It is optional. Without it, ABL keeps the current cycle up to date automatically.",
      "It is done on the ABL touchscreen; the browser portal does not have LOAD NXT. With two aircraft, it prepares the next cycle for each automatically managed aircraft."
    ]
  };

  // Messages ABL can show, for the quick reference at the end of the guide.
  var MESSAGES = [
    { name: "WIFI SETUP REQUIRED", means: "ABL is not on a network yet.", todo: "Tap the card, or use your phone to choose your hangar Wi-Fi." },
    { name: "JEPPESEN LOGIN REQUIRED", means: "No working Jeppesen sign-in (the browser portal shows REAUTHENTICATION REQUIRED if a saved one was rejected).", todo: "Tap the card, or sign in from the browser portal." },
    { name: "SELECT AIRCRAFT", means: "No aircraft chosen yet.", todo: "Tap the card and choose your aircraft." },
    { name: "USB SETUP REQUIRED", means: "With several aircraft, a USB needs an owner.", todo: "Tap the card, pick the USB and confirm the aircraft." },
    { name: "USB CONFLICT", means: "One USB is saved to two aircraft. Nothing is written until fixed.", todo: "Tap the card and give the USB to one aircraft." },
    { name: "NOT YET AVAILABLE", means: "Jeppesen has not released that cycle yet.", todo: "Nothing — ABL keeps checking." },
    { name: "LOAD NXT", means: "The next cycle is released but not yet effective.", todo: "Optional: tap it to prepare the next cycle early." },
    { name: "USB IN USE · DO NOT REMOVE", means: "ABL is writing or verifying the USB.", todo: "Leave the USB in place." },
    { name: "USB MEDIA READY · SAFE TO REMOVE", means: "Written, verified and safely unmounted.", todo: "Remove the USB." }
  ];

  root.ABLGuideModel = { TAILS: TAILS, AVIONICS: AVIONICS, MESSAGES: MESSAGES, TASKS: TASKS, NXT: NXT, setup: setup,
                         steps: steps, chartsPossible: chartsPossible };
})(typeof window !== "undefined" ? window : globalThis);
