#!/usr/bin/env python3
"""Maintainer tool: regenerate the guide's "What you'll see" images from the REAL ABL code.

- ABL screens: rendered by the current v8.2 WAVESHARE_800 renderer (bin/abl_ui_800.py on top of
  bin/ifd-console-dashboard) at the panel's native 800x480.
- Browser portal: the current local setup portal (bin/ifd-wifi-setup) captured in headless Chrome.

Only synthetic demonstration data is used (aircraft N247AP / N81JN, example cycles 2609/2610,
example addresses). Nothing is contacted. The images are committed under src/assets/, so the
published guide never needs this repository. Run from docs/abl-user-guide/:

    python3 scripts/render-screens.py

Requires Python 3 with Pillow (same as the ABL test suite) and Google Chrome/Chromium for the
portal captures (set CHROME=/path/to/chrome if it is not found).
"""
import copy
import importlib.machinery
import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

GUIDE = Path(__file__).resolve().parents[1]
REPO = GUIDE.parents[1]
OUT_ABL = GUIDE / "src/assets/abl"
OUT_WEB = GUIDE / "src/assets/portal"
sys.path.insert(0, str(REPO / "bin"))


def load(name, path):
    loader = importlib.machinery.SourceFileLoader(name, str(path))
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader))
    loader.exec_module(module)
    return module


# ---- Demonstration data ---------------------------------------------------------------------------
FULL = ["Electronic Charts", "NavData", "Obstacles"]
ONE = {"active_profile_id": "a", "usb_assignment_required": False,
       "profiles": [{"profile_id": "a", "tail_number": "N247AP", "write_enabled": True, "usb_media": [],
                     "package_products": FULL, "installed_avionics": {"IFD500": 1}}],
       "avionics": [{"profile_id": "a", "target_id": "IFD500", "family": "IFD500", "products": FULL,
                     "write_enabled": True}]}
TWO = {"active_profile_id": "a", "usb_assignment_required": True,
       "profiles": [{"profile_id": "a", "tail_number": "N247AP", "write_enabled": True, "usb_media": ["AAAA0001"],
                     "package_products": FULL, "installed_avionics": {"IFD500": 1}},
                    {"profile_id": "b", "tail_number": "N81JN", "write_enabled": True, "usb_media": [],
                     "package_products": FULL, "installed_avionics": {"IFD500": 1, "IFD400": 1}}],
       "avionics": [{"profile_id": "a", "target_id": "IFD500", "family": "IFD500", "products": FULL, "write_enabled": True},
                    {"profile_id": "b", "target_id": "IFD500", "family": "IFD500", "products": FULL, "write_enabled": True},
                    {"profile_id": "b", "target_id": "IFD400", "family": "IFD400", "products": ["NavData", "Obstacles"],
                     "write_enabled": True}]}
CHARTS = {"configured": True, "state": "current",
          "release": {"display_version": "20-2026", "start_date": "2026-09-25", "end_date": "2026-10-09"},
          "next_release": {"display_version": "21-2026", "start_date": "2026-10-09"}}
BASE = {"state": "current", "cycle": "2609", "current_cycle": "2609", "current_effective_date": "2026-09-03",
        "current_end_date": "2026-10-01", "next_cycle": "2610", "next_effective_date": "2026-10-01",
        "next_state": "expected", "message": "No action is required", "charts": CHARTS}
USB_NEW = {"device": "/dev/sdz", "size_bytes": 16_000_000_000, "safe_to_manage": True,
           "partitions": [{"fstype": "vfat", "label": "IFD", "fat_uuid": "BBBB0002"}]}
USB_OWNED = {"device": "/dev/sdy", "size_bytes": 16_000_000_000, "safe_to_manage": True,
             "partitions": [{"fstype": "vfat", "label": "N247AP", "fat_uuid": "AAAA0001"}]}


def status(**changes):
    value = copy.deepcopy(BASE)
    value.update(changes)
    return value


def busy(fleet, state):
    value = copy.deepcopy(fleet)
    for item in value["profiles"] + value["avionics"]:
        if item["profile_id"] == "a":
            item["runtime_state"] = state
    return value


def render_abl():
    ui = load("guide_dashboard", REPO / "bin/ifd-console-dashboard")
    native = load("guide_native", REPO / "bin/abl_ui_800.py")
    native.install(ui)
    native.CLOCK = lambda: 0.6                       # a fixed point in the activity sweep
    fleet_holder = {"value": ONE}
    for name, value in (("online", lambda: True), ("usb_media_count", lambda: 0),
                        ("ip_address", lambda *a, **k: "192.168.1.50"),
                        ("configured_aircraft_label", lambda: ""), ("jeppesen_account_username", lambda: "pilot@example.com"),
                        ("setup_password", lambda *a, **k: "flyIFDA1B2"),
                        ("setup_access_urls", lambda *a, **k: ("http://abl.local", "http://192.168.1.50")),
                        ("aircraft_fleet_summary", lambda: fleet_holder["value"])):
        setattr(ui, name, value)

    def dash(name, data, fleet=ONE, usb=0, selected="a"):
        fleet_holder["value"] = fleet
        ui.render_dashboard(data, environment={"network_ok": True, "usb_count": usb, "ip_address": "192.168.1.50"},
                            fleet=fleet, selected_profile_id=selected).save(OUT_ABL / f"{name}.png", optimize=True)

    def page(name, image, fleet=ONE):
        fleet_holder["value"] = fleet
        image.save(OUT_ABL / f"{name}.png", optimize=True)

    queue_a = {"mode": "multi_media", "profile_id": "a", "attached_media": 1, "current_index": 1, "prepared_media": 1}
    # Dashboard states
    dash("dashboard", status())
    dash("dashboard-load-nxt", status(next_state="available"))
    dash("dashboard-checking", status(state="checking", message="Checking internet and Jeppesen"))
    dash("dashboard-caching-nxt", status(state="downloading", cycle="2610", next_state="staging",
                                         message="Preparing the next cycle early"))
    dash("dashboard-ready-to-load", status(next_state="ready", next_verified=True, state="waiting_for_usb",
                                           message="Databases cached; insert an Avidyne USB drive"))
    dash("dashboard-writing", status(state="writing", progress_mode="activity", progress_phase="writing",
                                     message="Writing NavData and obstacles to the USB", media_queue=queue_a),
         fleet=busy(ONE, "writing"), usb=1)
    dash("dashboard-ready", status(state="ready", message="USB updated and safe to remove", media_queue=queue_a),
         fleet=busy(ONE, "ready"), usb=1)
    dash("dashboard-two-aircraft", status(), fleet=TWO)
    # Instruction cards
    dash("card-wifi", {"state": "wifi_setup", "ssid": "IFD-Updater-A1B2", "password": "flyIFDA1B2",
                       "address": "10.42.0.1"}, fleet={"profiles": []})
    dash("card-jeppesen", {"state": "jeppesen_setup", "mode": "setup"}, fleet={"profiles": []})
    dash("card-select-aircraft", {"state": "aircraft_setup", "message": ""}, fleet={"profiles": []})
    dash("card-usb-setup", {"state": "aircraft_setup", "message": "Assign a USB to N81JN before automatic preparation"},
         fleet=TWO)
    dash("card-usb-conflict", {"state": "aircraft_setup", "mode": "usb_conflict",
                               "message": "USB ownership conflict: one USB is assigned to two aircraft. "
                                          "No USB will be written until this is fixed."}, fleet=TWO)
    # Menus and setup pages on the touchscreen
    page("menu-device", ui.render_main_menu(status()), fleet=TWO)
    page("menu-settings", ui.render_settings_menu())
    page("web-setup-address", ui.render_setup_access(remaining=55))
    page("next-confirm", ui.render_next_cycle_confirmation(status(next_state="available")))
    group = {"aircraft_key": "b", "tail_number": "N81JN", "families": [
        {"family": "IFD500", "products": FULL}, {"family": "IFD400", "products": ["NavData", "Obstacles"]}]}
    page("aircraft-list", ui.render_aircraft_list({"supported_aircraft": [
        {"aircraft_key": "a", "tail_number": "N247AP", "families": [{"family": "IFD500", "products": FULL}]}, group]}))
    page("aircraft-avionics", ui.render_aircraft_targets(group, {("IFD500", "IFD500"), ("IFD400", "IFD400")}))
    page("chart-coverage", ui.render_chart_coverage(status(), "southwest", TWO, "a"), fleet=TWO)
    page("usb-manage", ui.render_media_drive_list([USB_OWNED, USB_NEW], "manage", 0, TWO), fleet=TWO)
    page("usb-confirm", ui.render_media_confirm(USB_NEW, "assign", "", "N81JN"), fleet=TWO)


# ---- Browser portal ------------------------------------------------------------------------------
def find_chrome():
    for candidate in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                      shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")):
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("Chrome/Chromium not found; set CHROME=/path/to/chrome")


def screenshot(chrome, html_path, png_path, width, height):
    """Headless Chrome screenshot; Chrome is stopped by us once the file is written."""
    png_path.unlink(missing_ok=True)
    profile = tempfile.mkdtemp(prefix="abl-guide-shot-")
    child = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                              "--disable-background-networking", "--disable-component-update",
                              f"--user-data-dir={profile}", f"--window-size={width},{height}",
                              f"--screenshot={png_path}", html_path.as_uri()],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        for _ in range(240):
            if png_path.exists() and png_path.stat().st_size > 0:
                time.sleep(0.5)
                break
            time.sleep(0.25)
    finally:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        shutil.rmtree(profile, ignore_errors=True)
    if not png_path.exists():
        raise SystemExit(f"screenshot failed: {png_path.name}")


def trim(png_path, background=(9, 11, 16)):
    """Crop trailing page background below the captured section."""
    image = Image.open(png_path).convert("RGB")
    width, height = image.size
    bottom = height
    pixels = image.load()
    while bottom > 40 and all(abs(pixels[x, bottom - 1][i] - background[i]) <= 3
                              for x in range(0, width, 7) for i in range(3)):
        bottom -= 1
    image.crop((0, 0, width, min(height, bottom + 24))).save(png_path, optimize=True)


def render_portal():
    web = load("guide_portal", REPO / "bin/ifd-wifi-setup")
    chrome = find_chrome()
    work = Path(tempfile.mkdtemp(prefix="abl-guide-portal-"))
    try:
        fleet = {"active_profile_id": "a", "profiles": [{"profile_id": "a", "tail_number": "N247AP"},
                                                         {"profile_id": "b", "tail_number": "N81JN"}]}
        web.JDM_AUTH = work / "auth.json"
        web.UPDATER_STATUS_FILE = work / "status.json"
        web.MARKER_FILE = work / "marker.json"
        web.CHART_PROFILE_FILE = work / "abl-chart-profile.json"
        web.AIRCRAFT_PROFILE_FILE = work / "aircraft.json"
        web.AIRCRAFT_PROFILE_FILE.write_text(json.dumps(fleet))
        (work / "abl-chart-profile-a.json").write_text(json.dumps({"schema_version": 1, "mode": "states", "runway_ft": 0,
                                                                   "states": ["AZ", "CA", "CO", "NM", "NV", "UT"], "countries": []}))
        web.current_wifi_ssid = lambda: "HANGAR"
        web.dashboard_config = lambda: {"metar_airport": "", "display_powerdown_minutes": 30}
        web.aircraft_profile_summary = lambda profile_id="": {"profile_id": "a"}
        networks = [{"ssid": "HANGAR", "signal": 82, "security": "WPA2"}, {"ssid": "FBO-GUEST", "signal": 61, "security": "WPA2"}]
        # Real chart coverage map from the product, so the page renders as on the ABL.
        map_svg = (REPO / "assets/north-america-map.svg").read_text()

        def capture(name, body, keep, height=1400):
            # Show only the section being illustrated (header kept); everything else hidden.
            style = ("<style>.wrap>form>*:not(" + keep + "),.wrap>form>script{display:none!important}"
                     ".foot{display:none}body{min-height:0}</style>")
            body = body.replace("</head>", style + "</head>").replace('href="/north-america-map.svg"',
                                                                         'href="north-america-map.svg"')
            html_path = work / f"{name}.html"
            html_path.write_text(body)
            (work / "north-america-map.svg").write_text(map_svg)
            png_path = OUT_WEB / f"{name}.png"
            screenshot(chrome, html_path, png_path, 520, height)
            trim(png_path)

        # First-time setup: the ABL's own setup Wi-Fi, choosing the hangar network.
        web.ap_active = lambda: True
        capture("portal-wifi", web.page(networks), "#network-settings", 1100)
        web.ap_active = lambda: False
        # Jeppesen account: not signed in yet, connected, and needing reauthentication.
        capture("portal-jeppesen-signin", web.page([]), "#jeppesen", 900)
        web.JDM_AUTH.write_text(json.dumps({"username": "pilot@example.com", "pwhash": "example"}))
        capture("portal-jeppesen-connected", web.page([]), "#jeppesen", 900)
        web.UPDATER_STATUS_FILE.write_text(json.dumps({"state": "login_required",
                                                       "message": "Jeppesen login needs attention; open phone setup"}))
        capture("portal-jeppesen-reauth", web.page([]), "#jeppesen", 900)
        web.UPDATER_STATUS_FILE.unlink()
        # Electronic Charts coverage for one aircraft, saved without a password.
        capture("portal-charts", web.page([], success="Electronic Charts coverage saved for N247AP.", chart_profile_id="a"),
                ".error,.success,#charts", 1500)
        # Aircraft / services page.
        inventory = {"supported_aircraft": [
            {"aircraft_key": "a", "tail_number": "N247AP", "manufacturer": "Cessna", "model": "172",
             "options": [{"option_id": "n1", "product": "NavData", "family": "IFD500", "coverage": "Americas",
                          "write_enabled": True},
                         {"option_id": "o1", "product": "Obstacles", "family": "IFD500", "coverage": "United States",
                          "write_enabled": True},
                         {"option_id": "c1", "product": "Electronic Charts", "family": "IFD500",
                          "coverage": "North America", "write_enabled": True}]}]}
        web.aircraft_inventory = lambda: inventory
        web.aircraft_fleet_summary = lambda: {"usb_assignment_required": True, "profiles": [
            {"profile_id": "a", "tail_number": "N247AP", "write_enabled": True, "usb_media": ["AAAA0001"],
             "installed_avionics": {"IFD500": 1}},
            {"profile_id": "b", "tail_number": "N81JN", "write_enabled": True, "usb_media": [],
             "installed_avionics": {"IFD500": 1, "IFD400": 1}}],
            "avionics": [{"profile_id": "a", "family": "IFD500", "target_id": "IFD500"},
                         {"profile_id": "b", "family": "IFD500", "target_id": "IFD500"},
                         {"profile_id": "b", "family": "IFD400", "target_id": "IFD400"}]}
        html_path = work / "portal-aircraft.html"
        html_path.write_text(web.aircraft_page())
        screenshot(chrome, html_path, OUT_WEB / "portal-aircraft.png", 520, 1500)
        trim(OUT_WEB / "portal-aircraft.png")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    for folder in (OUT_ABL, OUT_WEB):
        folder.mkdir(parents=True, exist_ok=True)
    render_abl()
    render_portal()
    for folder in (OUT_ABL, OUT_WEB):
        print(folder.relative_to(GUIDE), sorted(p.name for p in folder.glob("*.png")))
