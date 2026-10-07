"""
=============================================================================
CPU Process Scheduling Simulator - Local Python Backend
Provides Live System Process Detection using psutil and Flask.
=============================================================================

DISCLAIMER:
This backend reads running OS processes and calculates recent CPU activity
over an approximate 1-second interval to produce an estimated workload for
educational simulation in the CPU Process Scheduling Simulator.
It does NOT replace, control, pause, kill, or modify the operating system's
actual CPU scheduler or running processes.
"""

import os
import sys
import time
import math
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

# Enable CORS manually for maximum compatibility across any browser / file:// origin
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept"
    return response

# Clean friendly mapping for standard common processes on Windows / Mac / Linux
NAME_FRIENDLY_MAP = {
    "chrome": "Chrome",
    "google chrome": "Chrome",
    "code": "VS Code",
    "vscode": "VS Code",
    "powershell": "Terminal",
    "cmd": "Terminal",
    "windowsterminal": "Terminal",
    "bash": "Terminal",
    "zsh": "Terminal",
    "explorer": "File Explorer",
    "spotify": "Music",
    "music": "Music",
    "msedge": "Edge",
    "firefox": "Firefox",
    "brave": "Brave",
    "discord": "Discord",
    "slack": "Slack",
    "notepad": "Notepad",
    "taskmgr": "Task Manager",
    "python": "Python",
    "python3": "Python",
    "devenv": "Visual Studio",
    "obs64": "OBS Studio",
    "steam": "Steam"
}

def clean_process_name(raw_name):
    """
    Cleans a raw executable process name (e.g., 'chrome.exe', 'Code.exe')
    into a readable application title while preserving its real identity.
    """
    if not raw_name:
        return "Process"
    
    # Strip extension (e.g. .exe, .bin)
    base = os.path.splitext(raw_name)[0].strip()
    lookup = base.lower()

    if lookup in NAME_FRIENDLY_MAP:
        return NAME_FRIENDLY_MAP[lookup]

    # Convert snake_case or hyphenated or lowercase to clean Title Case
    cleaned = base.replace("_", " ").replace("-", " ")
    parts = cleaned.split()
    if parts:
        return " ".join(p.capitalize() for p in parts)
    return base

@app.route("/", methods=["GET"])
def index():
    """Serves index.html when user accesses http://localhost:5000"""
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>", methods=["GET"])
def static_files(filename):
    """Serves CSS, JS, and other local static assets"""
    return send_from_directory(".", filename)

@app.route("/api/processes", methods=["GET", "OPTIONS"])
def get_live_processes():
    """
    Endpoint: GET /api/processes
    Collects running processes, measures CPU activity over an approx 1-second
    snapshot interval, and derives estimated simulation burst times.
    """
    if request.method == "OPTIONS":
        return "", 204

    try:
        import psutil
    except ImportError:
        return jsonify({
            "success": False,
            "error": "psutil library is not installed. Please run: pip install -r requirements.txt"
        }), 500

    # -------------------------------------------------------------------------
    # Step 1: Initial CPU snapshot
    # Initialize cpu_percent tracking on all active processes
    # -------------------------------------------------------------------------
    initial_processes = {}
    for proc in psutil.process_iter(['pid', 'name', 'status']):
        try:
            # Prime CPU counter (first call returns 0.0 or primes interval tracker)
            proc.cpu_percent(interval=None)
            initial_processes[proc.pid] = proc
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    # -------------------------------------------------------------------------
    # Step 2: Sampling interval (~1.0 second)
    # Allows psutil to calculate actual CPU activity delta
    # -------------------------------------------------------------------------
    time.sleep(1.0)

    # -------------------------------------------------------------------------
    # Step 3: Second CPU snapshot & data collection
    # -------------------------------------------------------------------------
    raw_list = []
    for pid, proc in initial_processes.items():
        try:
            if not proc.is_running():
                continue

            cpu = proc.cpu_percent(interval=None)
            name = proc.name()
            status = proc.status()

            # Filter out idle process or PID 0
            if pid == 0 or name.lower() in ("system idle process", "idle"):
                continue

            raw_list.append({
                "pid": pid,
                "raw_name": name,
                "clean_name": clean_process_name(name),
                "cpu_percent": round(cpu, 1),
                "status": status
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    if not raw_list:
        return jsonify({
            "success": False,
            "error": "No accessible active processes found."
        }), 500

    # -------------------------------------------------------------------------
    # Step 4: Process Selection & Ranking
    # Prioritize active applications with non-zero CPU, then popular user apps.
    # Group by clean application name so we get diverse, distinct real apps.
    # -------------------------------------------------------------------------
    # Sort primarily by CPU activity descending, then PID
    raw_list.sort(key=lambda x: (x["cpu_percent"], x["pid"]), reverse=True)

    # Select top distinct application names to present a clean, diverse set (6-10 apps)
    seen_names = {}
    selected = []
    max_count = 8

    # First pass: pick the most active process per distinct application name
    for item in raw_list:
        cname = item["clean_name"]
        # Skip generic windows system daemons if we have user applications
        lower_raw = item["raw_name"].lower()
        if lower_raw in ("svchost.exe", "smss.exe", "csrss.exe", "services.exe", "lsass.exe"):
            continue

        if cname not in seen_names:
            seen_names[cname] = 1
            selected.append(item)
            if len(selected) >= max_count:
                break

    # If fewer than 5 user applications found, fill with remaining processes
    if len(selected) < 5:
        for item in raw_list:
            if item not in selected:
                cname = item["clean_name"]
                count = seen_names.get(cname, 0) + 1
                seen_names[cname] = count
                # Append PID to keep Process ID distinct
                item_copy = dict(item)
                item_copy["clean_name"] = f"{cname} ({item['pid']})"
                selected.append(item_copy)
                if len(selected) >= max_count:
                    break

    # If duplicates still exist in selected, ensure uniqueness
    name_counts = {}
    for item in selected:
        name_counts[item["clean_name"]] = name_counts.get(item["clean_name"], 0) + 1

    formatted_processes = []
    for idx, item in enumerate(selected):
        display_name = item["clean_name"]
        if name_counts[display_name] > 1:
            display_name = f"{display_name} ({item['pid']})"

        cpu = item["cpu_percent"]

        # ---------------------------------------------------------------------
        # Step 5: Derive Estimated CPU Burst Time (Simulation Value)
        # Scale CPU activity into an integer burst time between 1 and 10.
        # Formula: higher CPU -> higher burst time; baseline 1-3 if CPU is low.
        # ---------------------------------------------------------------------
        if cpu >= 1.0:
            estimated_bt = min(10, max(1, int(round(cpu / 10.0)) + 2))
        else:
            # Baseline small burst time for simulation (1, 2, or 3 based on pid)
            estimated_bt = (item["pid"] % 3) + 1

        # ---------------------------------------------------------------------
        # Step 6: Derive Simulation Priority
        # Deterministic simulation priority (1 = highest priority).
        # We assign 1 to N based on ranking so Priority scheduling works.
        # ---------------------------------------------------------------------
        simulation_priority = idx + 1

        formatted_processes.append({
            "name": display_name,
            "pid": item["pid"],
            "at": 0,  # Arrival Time = 0 for snapshot
            "estimated_bt": estimated_bt,
            "simulation_priority": simulation_priority,
            "cpu_percent": cpu,
            "status": item["status"]
        })

    return jsonify({
        "success": True,
        "count": len(formatted_processes),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "processes": formatted_processes,
        "note": "Estimated burst time is derived from recent CPU activity for simulation purposes. It is not the exact future CPU burst time of the real process.",
        "priority_note": "Priority is assigned for simulation and does not represent the actual OS scheduler priority."
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 70)
    print(" CPU Process Scheduling Simulator - Local Backend")
    print("=" * 70)
    print(f" * Backend server running on: http://127.0.0.1:{port}")
    print(f" * Process API Endpoint:     http://127.0.0.1:{port}/api/processes")
    print(" * Ready for Live System Mode requests from index.html")
    print("=" * 70)
    app.run(host="127.0.0.1", port=port, debug=False)
