/**
 * ==============================================================================
 * CPU Process Scheduling Simulator
 * Core Simulation Engine & UI Controller
 * ==============================================================================
 * 
 * Algorithms Implemented:
 * 1. FCFS (First Come First Serve) - Non-preemptive
 * 2. SJF (Shortest Job First) - Non-preemptive
 * 3. Priority Scheduling - Non-preemptive (lower number = higher priority)
 * 4. Round Robin (RR) - Preemptive (with Time Quantum)
 * 
 * Key Formulas:
 * - Turnaround Time (TAT) = Completion Time (CT) - Arrival Time (AT)
 * - Waiting Time (WT)    = Turnaround Time (TAT) - Burst Time (BT)
 * - Response Time (RT)   = First Start Time - Arrival Time (AT)
 * - CPU Utilization      = (Total CPU Busy Time / Total Simulation Time) * 100%
 */

// ==============================================================================
// 1. Color Palette Management for Gantt Chart
// ==============================================================================
const PROCESS_COLORS = [
    { bg: "#3b82f6", text: "#ffffff", border: "#2563eb" }, // Blue
    { bg: "#8b5cf6", text: "#ffffff", border: "#7c3aed" }, // Violet
    { bg: "#10b981", text: "#ffffff", border: "#059669" }, // Emerald
    { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }, // Amber
    { bg: "#ec4899", text: "#ffffff", border: "#db2777" }, // Pink
    { bg: "#06b6d4", text: "#ffffff", border: "#0891b2" }, // Cyan
    { bg: "#f97316", text: "#ffffff", border: "#ea580c" }, // Orange
    { bg: "#6366f1", text: "#ffffff", border: "#4f46e5" }, // Indigo
    { bg: "#14b8a6", text: "#ffffff", border: "#0d9488" }, // Teal
    { bg: "#84cc16", text: "#ffffff", border: "#65a30d" }  // Lime
];

const colorMap = new Map();

/**
 * Returns a stable, distinct color for a given Process ID.
 */
function getProcessColor(pid) {
    if (pid === "IDLE") {
        return { bg: "#f1f5f9", text: "#475569", border: "#94a3b8" };
    }
    if (!colorMap.has(pid)) {
        const index = colorMap.size % PROCESS_COLORS.length;
        colorMap.set(pid, PROCESS_COLORS[index]);
    }
    return colorMap.get(pid);
}

// ==============================================================================
// 2. Algorithm Descriptions & Educational Viva Notes
// ==============================================================================
const ALGO_DETAILS = {
    FCFS: {
        name: "First Come First Serve (FCFS)",
        desc: "Executes processes strictly in the order they arrive in the ready queue.",
        type: "Non-preemptive",
        tie: "Process ID (PID) order",
        note: "Simple FIFO queue implementation, but can suffer from the 'Convoy Effect' where short CPU-burst processes are forced to wait behind long processes.",
        badgeClass: "non-preempt"
    },
    SJF: {
        name: "Shortest Job First (SJF)",
        desc: "Selects the process with the smallest CPU burst time among all arrived processes.",
        type: "Non-preemptive",
        tie: "Earlier Arrival Time, then PID",
        note: "Provably optimal in minimizing average waiting time for a given set of processes. However, it can cause starvation for longer processes if short processes keep arriving.",
        badgeClass: "non-preempt"
    },
    Priority: {
        name: "Priority Scheduling",
        desc: "Executes the arrived process with the highest priority first (Smaller number = Higher priority).",
        type: "Non-preemptive",
        tie: "Earlier Arrival Time, then PID",
        note: "Ensures urgent tasks execute first. Can lead to indefinite blocking / starvation of low-priority processes. Aging (gradually increasing priority over time) is used to prevent starvation.",
        badgeClass: "non-preempt"
    },
    RR: {
        name: "Round Robin (RR)",
        desc: "Each process receives a fixed time slice (Time Quantum) in cyclic order according to the ready queue.",
        type: "Preemptive",
        tie: "Arrival Time in Ready Queue",
        note: "Ensures fairness and excellent response time for interactive time-sharing systems. Performance heavily depends on Time Quantum: too large behaves like FCFS; too small causes excessive context-switching overhead.",
        badgeClass: "preempt"
    }
};

// ==============================================================================
// 3. Scheduling Algorithms Implementation
// ==============================================================================

/**
 * Helper: Creates a deep copy of the process list with simulation tracking fields.
 */
function initializeProcesses(inputList) {
    return inputList.map(p => ({
        id: String(p.id).trim(),
        at: Number(p.at),
        bt: Number(p.bt),
        priority: Number(p.priority),
        remainingBt: Number(p.bt),
        completionTime: 0,
        turnaroundTime: 0,
        waitingTime: 0,
        responseTime: -1,
        firstStartTime: -1
    }));
}

/**
 * Helper: Natural sort comparator for Process IDs (e.g., P1, P2, P10).
 */
function compareProcessIds(idA, idB) {
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * 1. FCFS - First Come First Serve (Non-preemptive)
 */
function simulateFCFS(inputList) {
    const procs = initializeProcesses(inputList);

    // Sort by Arrival Time ascending. Tie-breaker: Process ID
    procs.sort((a, b) => {
        if (a.at !== b.at) return a.at - b.at;
        return compareProcessIds(a.id, b.id);
    });

    let currentTime = 0;
    const timeline = [];

    for (let i = 0; i < procs.length; i++) {
        const p = procs[i];

        // Handle CPU Idle time before process arrives
        if (currentTime < p.at) {
            timeline.push({ id: "IDLE", start: currentTime, end: p.at });
            currentTime = p.at;
        }

        const start = currentTime;
        p.firstStartTime = start;
        p.responseTime = start - p.at;

        currentTime += p.bt;
        p.completionTime = currentTime;
        p.turnaroundTime = p.completionTime - p.at;
        p.waitingTime = p.turnaroundTime - p.bt;

        timeline.push({ id: p.id, start: start, end: currentTime });
    }

    return compileSimulationResult(procs, timeline);
}

/**
 * 2. SJF - Shortest Job First (Non-preemptive)
 */
function simulateSJF(inputList) {
    const procs = initializeProcesses(inputList);
    const n = procs.length;
    let completed = 0;
    let currentTime = 0;
    const timeline = [];

    while (completed < n) {
        // Collect arrived processes that have remaining burst time
        const available = procs.filter(p => p.at <= currentTime && p.remainingBt > 0);

        if (available.length === 0) {
            // CPU is idle: Jump to the earliest next arrival time
            let nextArrival = Infinity;
            for (const p of procs) {
                if (p.remainingBt > 0 && p.at < nextArrival) {
                    nextArrival = p.at;
                }
            }
            timeline.push({ id: "IDLE", start: currentTime, end: nextArrival });
            currentTime = nextArrival;
            continue;
        }

        // Select process with smallest burst time
        // Tie-breakers: Earlier arrival time, then PID
        available.sort((a, b) => {
            if (a.bt !== b.bt) return a.bt - b.bt;
            if (a.at !== b.at) return a.at - b.at;
            return compareProcessIds(a.id, b.id);
        });

        const p = available[0];
        const start = currentTime;
        p.firstStartTime = start;
        p.responseTime = start - p.at;

        currentTime += p.bt;
        p.completionTime = currentTime;
        p.turnaroundTime = p.completionTime - p.at;
        p.waitingTime = p.turnaroundTime - p.bt;
        p.remainingBt = 0;
        completed++;

        timeline.push({ id: p.id, start: start, end: currentTime });
    }

    return compileSimulationResult(procs, timeline);
}

/**
 * 3. Priority Scheduling (Non-preemptive, Smaller number = Higher Priority)
 */
function simulatePriority(inputList) {
    const procs = initializeProcesses(inputList);
    const n = procs.length;
    let completed = 0;
    let currentTime = 0;
    const timeline = [];

    while (completed < n) {
        // Collect arrived processes that have remaining burst time
        const available = procs.filter(p => p.at <= currentTime && p.remainingBt > 0);

        if (available.length === 0) {
            // CPU is idle: Jump to the earliest next arrival time
            let nextArrival = Infinity;
            for (const p of procs) {
                if (p.remainingBt > 0 && p.at < nextArrival) {
                    nextArrival = p.at;
                }
            }
            timeline.push({ id: "IDLE", start: currentTime, end: nextArrival });
            currentTime = nextArrival;
            continue;
        }

        // Select process with smallest priority number (highest priority)
        // Tie-breakers: Earlier arrival time, then PID
        available.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.at !== b.at) return a.at - b.at;
            return compareProcessIds(a.id, b.id);
        });

        const p = available[0];
        const start = currentTime;
        p.firstStartTime = start;
        p.responseTime = start - p.at;

        currentTime += p.bt;
        p.completionTime = currentTime;
        p.turnaroundTime = p.completionTime - p.at;
        p.waitingTime = p.turnaroundTime - p.bt;
        p.remainingBt = 0;
        completed++;

        timeline.push({ id: p.id, start: start, end: currentTime });
    }

    return compileSimulationResult(procs, timeline);
}

/**
 * 4. Round Robin (Preemptive, with Time Quantum)
 */
function simulateRoundRobin(inputList, timeQuantum) {
    const procs = initializeProcesses(inputList);
    const n = procs.length;
    let completed = 0;
    let currentTime = 0;
    const timeline = [];

    // Sort initially by Arrival Time, then PID for deterministic queueing
    const sortedProcs = procs.slice().sort((a, b) => {
        if (a.at !== b.at) return a.at - b.at;
        return compareProcessIds(a.id, b.id);
    });

    const readyQueue = [];
    const enqueuedMap = new Set();

    // Check if initial CPU idle time exists before any process arrives
    if (sortedProcs[0].at > currentTime) {
        timeline.push({ id: "IDLE", start: currentTime, end: sortedProcs[0].at });
        currentTime = sortedProcs[0].at;
    }

    // Enqueue processes arriving at or before currentTime
    for (const p of sortedProcs) {
        if (p.at <= currentTime && !enqueuedMap.has(p.id)) {
            readyQueue.push(p);
            enqueuedMap.add(p.id);
        }
    }

    while (completed < n) {
        if (readyQueue.length === 0) {
            // CPU is idle: find next unvisited arrival
            let nextArrival = Infinity;
            for (const p of sortedProcs) {
                if (!enqueuedMap.has(p.id) && p.at < nextArrival) {
                    nextArrival = p.at;
                }
            }

            if (nextArrival !== Infinity) {
                timeline.push({ id: "IDLE", start: currentTime, end: nextArrival });
                currentTime = nextArrival;

                for (const p of sortedProcs) {
                    if (p.at <= currentTime && !enqueuedMap.has(p.id)) {
                        readyQueue.push(p);
                        enqueuedMap.add(p.id);
                    }
                }
            }
            continue;
        }

        const currentProc = readyQueue.shift();

        // First start time for calculating Response Time
        if (currentProc.firstStartTime === -1) {
            currentProc.firstStartTime = currentTime;
            currentProc.responseTime = currentTime - currentProc.at;
        }

        const execDuration = Math.min(timeQuantum, currentProc.remainingBt);
        const start = currentTime;
        currentTime += execDuration;
        currentProc.remainingBt -= execDuration;

        timeline.push({ id: currentProc.id, start: start, end: currentTime });

        // Add any newly arrived processes during this time quantum BEFORE re-enqueueing current process
        for (const p of sortedProcs) {
            if (p.at <= currentTime && !enqueuedMap.has(p.id)) {
                readyQueue.push(p);
                enqueuedMap.add(p.id);
            }
        }

        // If the process has remaining burst time, push it back to the ready queue
        if (currentProc.remainingBt > 0) {
            readyQueue.push(currentProc);
        } else {
            // Process completed
            currentProc.completionTime = currentTime;
            currentProc.turnaroundTime = currentProc.completionTime - currentProc.at;
            currentProc.waitingTime = currentProc.turnaroundTime - currentProc.bt;
            completed++;
        }
    }

    return compileSimulationResult(procs, timeline);
}

/**
 * Helper: Compiles final metrics and returns a standardized simulation result object.
 */
function compileSimulationResult(procs, timeline) {
    const n = procs.length;
    let sumTat = 0;
    let sumWt = 0;
    let sumRt = 0;
    let totalBusyTime = 0;

    for (const p of procs) {
        sumTat += p.turnaroundTime;
        sumWt += p.waitingTime;
        sumRt += p.responseTime;
        totalBusyTime += p.bt;
    }

    const totalSimulationTime = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;
    const totalIdleTime = Math.max(0, totalSimulationTime - totalBusyTime);
    const cpuUtil = totalSimulationTime > 0 ? (totalBusyTime / totalSimulationTime) * 100 : 0;

    // Display sort by Process ID
    const sortedProcs = procs.slice().sort((a, b) => compareProcessIds(a.id, b.id));

    return {
        procs: sortedProcs,
        timeline: timeline,
        totalTime: totalSimulationTime,
        busyTime: totalBusyTime,
        idleTime: totalIdleTime,
        cpuUtil: cpuUtil,
        avgTat: sumTat / n,
        avgWt: sumWt / n,
        avgRt: sumRt / n
    };
}

// ==============================================================================
// 4. Input Validation & Error Handling
// ==============================================================================

/**
 * Validates process table rows and Time Quantum input.
 * Returns an object { isValid: boolean, error: string, processes: array, timeQuantum: number }
 */
function validateInputs() {
    const tableBody = document.getElementById("process-table-body");
    const rows = tableBody.querySelectorAll("tr");

    if (rows.length === 0) {
        return { isValid: false, error: "Please add at least one process to run the simulation." };
    }

    const parsedProcesses = [];
    const pidSet = new Set();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        const pidInput = row.querySelector(".pid-input");
        const atInput = row.querySelector(".at-input");
        const btInput = row.querySelector(".bt-input");
        const priorityInput = row.querySelector(".priority-input");

        const pid = pidInput ? pidInput.value.trim() : "";
        const atStr = atInput ? atInput.value.trim() : "";
        const btStr = btInput ? btInput.value.trim() : "";
        const prioStr = priorityInput ? priorityInput.value.trim() : "";

        // 1. Process ID Validation
        if (!pid) {
            return { isValid: false, error: `Row ${rowNum}: Process ID cannot be empty.` };
        }
        const upperPid = pid.toUpperCase();
        if (upperPid === "IDLE") {
            return { isValid: false, error: `Row ${rowNum}: 'IDLE' is a reserved system keyword. Please choose a different Process ID.` };
        }
        if (pidSet.has(upperPid)) {
            return { isValid: false, error: `Duplicate Process ID '${pid}' found in Row ${rowNum}. Each process must have a unique ID.` };
        }
        pidSet.add(upperPid);

        // 2. Arrival Time Validation
        if (atStr === "" || isNaN(Number(atStr))) {
            return { isValid: false, error: `Row ${rowNum} (${pid}): Arrival Time must be a valid number.` };
        }
        const at = Number(atStr);
        if (at < 0) {
            return { isValid: false, error: `Row ${rowNum} (${pid}): Arrival Time cannot be negative (must be &ge; 0).` };
        }

        // 3. Burst Time Validation
        if (btStr === "" || isNaN(Number(btStr))) {
            return { isValid: false, error: `Row ${rowNum} (${pid}): Burst Time must be a valid number.` };
        }
        const bt = Number(btStr);
        if (bt <= 0) {
            return { isValid: false, error: `Row ${rowNum} (${pid}): Burst Time must be strictly greater than 0.` };
        }

        // 4. Priority Validation
        let priority = 1;
        if (prioStr !== "") {
            if (isNaN(Number(prioStr))) {
                return { isValid: false, error: `Row ${rowNum} (${pid}): Priority must be a valid number.` };
            }
            priority = Number(prioStr);
        }

        parsedProcesses.push({
            id: pid,
            at: at,
            bt: bt,
            priority: priority
        });
    }

    // 5. Time Quantum Validation for Round Robin
    const selectedAlgo = getSelectedAlgorithm();
    let timeQuantum = 2;

    if (selectedAlgo === "RR") {
        const tqInput = document.getElementById("time-quantum");
        const tqStr = tqInput.value.trim();
        if (tqStr === "" || isNaN(Number(tqStr))) {
            return { isValid: false, error: "Time Quantum must be a valid positive number for Round Robin." };
        }
        timeQuantum = Number(tqStr);
        if (timeQuantum <= 0) {
            return { isValid: false, error: "Time Quantum must be strictly greater than 0." };
        }
    }

    return {
        isValid: true,
        error: "",
        processes: parsedProcesses,
        timeQuantum: timeQuantum
    };
}

function showValidationError(message) {
    const alertBox = document.getElementById("validation-alert");
    const messageContainer = document.getElementById("validation-message");
    messageContainer.innerHTML = message;
    alertBox.classList.remove("hidden");
    alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearValidationError() {
    const alertBox = document.getElementById("validation-alert");
    alertBox.classList.add("hidden");
}

// ==============================================================================
// 5. UI Rendering & DOM Manipulation
// ==============================================================================

/**
 * Retrieves the currently selected scheduling algorithm key (FCFS, SJF, Priority, RR).
 */
function getSelectedAlgorithm() {
    const checkedRadio = document.querySelector('input[name="algorithm"]:checked');
    return checkedRadio ? checkedRadio.value : "FCFS";
}

/**
 * Updates algorithm description card and toggles Time Quantum field visibility.
 */
function updateAlgorithmUI() {
    const algoKey = getSelectedAlgorithm();

    // Toggle Time Quantum visibility
    const tqContainer = document.getElementById("quantum-container");
    if (tqContainer) {
        if (algoKey === "RR") {
            tqContainer.classList.remove("hidden");
        } else {
            tqContainer.classList.add("hidden");
        }
    }

    // Enable/disable priority inputs visual indication
    const priorityInputs = document.querySelectorAll(".priority-input");
    priorityInputs.forEach(input => {
        if (algoKey === "Priority") {
            input.classList.remove("disabled-input");
            input.title = "Priority number (smaller = higher priority)";
        } else {
            input.classList.remove("disabled-input");
            input.title = "Used when Priority Scheduling is selected";
        }
    });
}

/**
 * Adds a new process row to the input table.
 * Supports optional live process metadata (PID, CPU activity, status).
 */
function addProcessRow(id = "", at = 0, bt = 1, priority = 1, meta = null) {
    const tableBody = document.getElementById("process-table-body");
    if (!tableBody) return;
    const existingCount = tableBody.querySelectorAll("tr").length;

    // Generate auto Process ID if not provided
    const defaultId = id || `P${existingCount + 1}`;

    let metaTagHtml = "";
    let tooltipTitle = "";
    if (meta) {
        tooltipTitle = `PID: ${meta.pid} | CPU Activity: ${meta.cpu_percent}% | Status: ${meta.status}`;
        metaTagHtml = `<div class="live-meta-tag" title="${tooltipTitle}">PID: ${meta.pid} &bull; CPU: ${meta.cpu_percent}% &bull; ${meta.status}</div>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>
            <input type="text" class="pid-input" value="${defaultId}" placeholder="e.g. P${existingCount + 1}" title="${tooltipTitle}" required>
            ${metaTagHtml}
        </td>
        <td>
            <input type="number" class="at-input" min="0" step="1" value="${at}" placeholder="0" required>
        </td>
        <td>
            <input type="number" class="bt-input" min="1" step="1" value="${bt}" placeholder="1" required>
        </td>
        <td>
            <input type="number" class="priority-input" step="1" value="${priority}" placeholder="1">
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn-icon-del" title="Delete this process">&times;</button>
        </td>
    `;

    // Attach row delete event
    const deleteBtn = tr.querySelector(".btn-icon-del");
    deleteBtn.addEventListener("click", () => {
        tr.remove();
        clearValidationError();
    });

    tableBody.appendChild(tr);
}

/**
 * Removes the bottom-most process row.
 */
function removeLastProcessRow() {
    const tableBody = document.getElementById("process-table-body");
    if (!tableBody) return;
    const rows = tableBody.querySelectorAll("tr");
    if (rows.length > 0) {
        rows[rows.length - 1].remove();
        clearValidationError();
    }
}

/**
 * Clears all process rows.
 */
function clearAllProcessRows() {
    const tableBody = document.getElementById("process-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    const resultsSec = document.getElementById("results-section");
    if (resultsSec) resultsSec.classList.add("hidden");
    clearValidationError();
}

/**
 * Loads the standard college test dataset as specified in project requirements:
 * P1: AT=0, BT=5, Priority=2
 * P2: AT=1, BT=3, Priority=1
 * P3: AT=2, BT=2, Priority=3
 * Time Quantum = 2
 */
function loadExampleData() {
    clearAllProcessRows();
    updateTableHeadersForMode(false);
    updateLiveStatus("Manual Mode", "manual");
    isLiveModeActive = false;

    addProcessRow("P1", 0, 5, 2);
    addProcessRow("P2", 1, 3, 1);
    addProcessRow("P3", 2, 2, 3);
    const tqEl = document.getElementById("time-quantum");
    if (tqEl) tqEl.value = "2";
    clearValidationError();
}

/**
 * Renders the Visual Gantt Chart.
 */
function renderGanttChart(timeline, totalTime, procs) {
    const ganttContainer = document.getElementById("gantt-container");
    const scaleContainer = document.getElementById("gantt-scale");
    const legendContainer = document.getElementById("gantt-legend");

    ganttContainer.innerHTML = "";
    scaleContainer.innerHTML = "";
    legendContainer.innerHTML = "";

    if (!timeline || timeline.length === 0 || totalTime === 0) {
        ganttContainer.innerHTML = '<div style="padding: 16px; color: #64748b;">No timeline data available.</div>';
        return;
    }

    // 1. Build Legend
    const uniqueProcessIds = [...new Set(procs.map(p => p.id))];
    uniqueProcessIds.sort(compareProcessIds);

    uniqueProcessIds.forEach(pid => {
        const color = getProcessColor(pid);
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <span class="legend-swatch" style="background-color: ${color.bg}; border-color: ${color.border};"></span>
            <span>${pid}</span>
        `;
        legendContainer.appendChild(item);
    });

    // Add Idle swatch to legend
    const idleColor = getProcessColor("IDLE");
    const idleItem = document.createElement("div");
    idleItem.className = "legend-item";
    idleItem.innerHTML = `
        <span class="legend-swatch" style="background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 4px, #e2e8f0 4px, #e2e8f0 8px); border: 1px dashed #94a3b8;"></span>
        <span>CPU Idle</span>
    `;
    legendContainer.appendChild(idleItem);

    // 2. Render Gantt Blocks & Time Marks
    // We collect all distinct boundary timestamps to render ticks
    const timePoints = new Set([0]);

    timeline.forEach(segment => {
        const duration = segment.end - segment.start;
        const widthPercent = (duration / totalTime) * 100;
        timePoints.add(segment.start);
        timePoints.add(segment.end);

        const block = document.createElement("div");
        block.className = "gantt-block";
        block.style.width = `${widthPercent}%`;
        block.style.flexGrow = duration;

        const isIdle = segment.id === "IDLE";
        if (isIdle) {
            block.classList.add("idle-block");
            block.innerHTML = `
                <span class="gantt-block-pid">IDLE</span>
                <span class="gantt-block-duration">${duration} unit${duration > 1 ? 's' : ''}</span>
            `;
            block.title = `CPU Idle: [${segment.start} &rarr; ${segment.end}] (${duration} time units)`;
        } else {
            const color = getProcessColor(segment.id);
            block.style.backgroundColor = color.bg;
            block.style.borderColor = color.border;
            block.innerHTML = `
                <span class="gantt-block-pid">${segment.id}</span>
                <span class="gantt-block-duration">${duration} unit${duration > 1 ? 's' : ''}</span>
            `;
            block.title = `${segment.id}: [${segment.start} &rarr; ${segment.end}] (Burst duration: ${duration})`;
        }

        ganttContainer.appendChild(block);
    });

    // 3. Render Accurate Time Markers along Timeline
    const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
    sortedTimePoints.forEach(t => {
        const leftPercent = (t / totalTime) * 100;
        const tick = document.createElement("div");
        tick.className = "time-tick";
        tick.style.left = `${leftPercent}%`;
        if (leftPercent === 0) {
            tick.style.transform = "translateX(0%)";
        } else if (leftPercent >= 99.9) {
            tick.style.transform = "translateX(-100%)";
        } else {
            tick.style.transform = "translateX(-50%)";
        }
        tick.textContent = t;
        scaleContainer.appendChild(tick);
    });
}

/**
 * Renders the Process Metrics Table and summary row.
 */
function renderResultsTable(procs, avgTat, avgWt, avgRt) {
    const tableBody = document.getElementById("results-table-body");
    const tableFoot = document.getElementById("results-table-foot");

    tableBody.innerHTML = "";
    tableFoot.innerHTML = "";

    procs.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.id}</strong></td>
            <td>${p.at}</td>
            <td>${p.bt}</td>
            <td>${p.priority}</td>
            <td>${p.completionTime}</td>
            <td>${p.turnaroundTime}</td>
            <td>${p.waitingTime}</td>
            <td>${p.responseTime}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Footer with Averages
    const footTr = document.createElement("tr");
    footTr.innerHTML = `
        <td colspan="5" style="text-align: right; padding-right: 20px;"><strong>Average Values:</strong></td>
        <td><strong>${avgTat.toFixed(2)}</strong></td>
        <td><strong>${avgWt.toFixed(2)}</strong></td>
        <td><strong>${avgRt.toFixed(2)}</strong></td>
    `;
    tableFoot.appendChild(footTr);
}

/**
 * Updates the 4 Performance Metric Cards.
 */
function renderMetricCards(result) {
    document.getElementById("val-avg-tat").textContent = result.avgTat.toFixed(2);
    document.getElementById("val-avg-wt").textContent = result.avgWt.toFixed(2);
    document.getElementById("val-avg-rt").textContent = result.avgRt.toFixed(2);
    document.getElementById("val-cpu-util").textContent = `${result.cpuUtil.toFixed(2)}%`;

    document.getElementById("val-time-details").textContent = 
        `Busy: ${result.busyTime} / Total: ${result.totalTime} (Idle: ${result.idleTime})`;

    const progressBar = document.getElementById("cpu-progress-bar");
    progressBar.style.width = `${Math.min(100, Math.max(0, result.cpuUtil))}%`;
}

/**
 * Runs all 4 scheduling algorithms on the input processes and populates the comparison table.
 */
function renderComparisonSection(processes, timeQuantum, currentAlgo) {
    const tableBody = document.getElementById("comparison-table-body");
    tableBody.innerHTML = "";

    const algorithms = [
        { key: "FCFS", name: "First Come First Serve (FCFS)", fn: () => simulateFCFS(processes) },
        { key: "SJF", name: "Shortest Job First (SJF)", fn: () => simulateSJF(processes) },
        { key: "Priority", name: "Priority Scheduling", fn: () => simulatePriority(processes) },
        { key: "RR", name: `Round Robin (RR, TQ=${timeQuantum})`, fn: () => simulateRoundRobin(processes, timeQuantum) }
    ];

    algorithms.forEach(algo => {
        const res = algo.fn();
        const details = ALGO_DETAILS[algo.key];
        const isActive = algo.key === currentAlgo;

        const tr = document.createElement("tr");
        if (isActive) {
            tr.className = "active-sim-row";
        }

        tr.innerHTML = `
            <td class="algo-name-cell">
                ${algo.name} ${isActive ? '<span style="color: var(--primary); font-size: 0.8rem;">(Active)</span>' : ''}
            </td>
            <td><span class="algo-badge ${details.badgeClass}">${details.type}</span></td>
            <td><strong>${res.avgWt.toFixed(2)}</strong></td>
            <td><strong>${res.avgTat.toFixed(2)}</strong></td>
            <td><strong>${res.avgRt.toFixed(2)}</strong></td>
            <td>${res.cpuUtil.toFixed(2)}%</td>
            <td style="font-size: 0.82rem; color: var(--text-muted);">${details.note.split('.')[0]}.</td>
        `;

        tableBody.appendChild(tr);
    });

    // Educational Viva Takeaway
    const analysisBox = document.getElementById("comparison-analysis-text");
    analysisBox.innerHTML = `
        For this batch of processes:
        <br>&bull; <strong>SJF</strong> aims to minimize Average Waiting Time (<em>WT</em>) among non-preemptive algorithms.
        <br>&bull; <strong>Round Robin</strong> guarantees fair time sharing and typically improves initial Response Time (<em>RT</em>).
        <br>&bull; <strong>Priority Scheduling</strong> guarantees that high-priority tasks execute promptly regardless of burst time.
        <br>&bull; <strong>FCFS</strong> has the lowest scheduling complexity with no preemption overhead.
        <br><em>Remember: In operating systems, no single algorithm is universally "best" — the choice depends on design goals such as fairness, interactivity, and throughput.</em>
    `;
}

// ==============================================================================
// 6. Simulation Controller
// ==============================================================================

/**
 * Main simulation runner: Validates inputs, executes selected algorithm, and renders UI.
 */
function runSimulation() {
    clearValidationError();

    const validation = validateInputs();
    if (!validation.isValid) {
        showValidationError(validation.error);
        return;
    }

    const { processes, timeQuantum } = validation;
    const selectedAlgo = getSelectedAlgorithm();

    let simResult;
    switch (selectedAlgo) {
        case "FCFS":
            simResult = simulateFCFS(processes);
            break;
        case "SJF":
            simResult = simulateSJF(processes);
            break;
        case "Priority":
            simResult = simulatePriority(processes);
            break;
        case "RR":
            simResult = simulateRoundRobin(processes, timeQuantum);
            break;
        default:
            simResult = simulateFCFS(processes);
    }

    // Update Simulation Tag
    const algoName = ALGO_DETAILS[selectedAlgo].name;
    document.getElementById("current-sim-tag").textContent = `Algorithm: ${algoName}${selectedAlgo === 'RR' ? ` (TQ=${timeQuantum})` : ''}`;

    // Render components
    renderGanttChart(simResult.timeline, simResult.totalTime, simResult.procs);
    renderResultsTable(simResult.procs, simResult.avgTat, simResult.avgWt, simResult.avgRt);
    renderMetricCards(simResult);
    renderComparisonSection(processes, timeQuantum, selectedAlgo);

    // Show Results Section
    const resultsSection = document.getElementById("results-section");
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==============================================================================
// 7. Live System Mode Controller
// ==============================================================================
const LIVE_BACKEND_URL = "http://127.0.0.1:5000/api/processes";
let isLiveModeActive = false;

function updateLiveStatus(text, type = "manual") {
    const badge = document.getElementById("mode-status-badge");
    if (!badge) return;
    badge.className = `mode-status-badge badge-${type}`;
    badge.textContent = text;
}

function showLiveBackendAlert(message) {
    const alertEl = document.getElementById("live-backend-alert");
    const msgEl = document.getElementById("live-backend-alert-text");
    if (msgEl) msgEl.textContent = message;
    if (alertEl) alertEl.classList.remove("hidden");
}

function hideLiveBackendAlert() {
    const alertEl = document.getElementById("live-backend-alert");
    if (alertEl) alertEl.classList.add("hidden");
}

function updateTableHeadersForMode(isLive) {
    const thId = document.getElementById("th-process-id");
    const thBt = document.getElementById("th-burst-time");
    const thPrio = document.getElementById("th-priority");
    const activeNotice = document.getElementById("live-active-notice");
    const refreshBtn = document.getElementById("btn-refresh-processes");
    const switchBtn = document.getElementById("btn-switch-manual");

    if (isLive) {
        if (thId) thId.textContent = "Process (Real OS Process)";
        if (thBt) thBt.textContent = "Estimated Burst Time (BT)";
        if (thPrio) thPrio.textContent = "Simulation Priority";
        if (activeNotice) activeNotice.classList.remove("hidden");
        if (refreshBtn) refreshBtn.classList.remove("hidden");
        if (switchBtn) switchBtn.classList.remove("hidden");
    } else {
        if (thId) thId.textContent = "Process ID";
        if (thBt) thBt.textContent = "Burst Time (BT)";
        if (thPrio) thPrio.textContent = "Priority";
        if (activeNotice) activeNotice.classList.add("hidden");
        if (refreshBtn) refreshBtn.classList.add("hidden");
        if (switchBtn) switchBtn.classList.add("hidden");
    }
}

async function detectRunningProcesses() {
    hideLiveBackendAlert();
    clearValidationError();
    updateLiveStatus("Detecting live processes...", "detecting");

    const detectBtn = document.getElementById("btn-detect-processes");
    const refreshBtn = document.getElementById("btn-refresh-processes");
    if (detectBtn) detectBtn.disabled = true;
    if (refreshBtn) refreshBtn.disabled = true;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for 1s snapshot

        const response = await fetch(LIVE_BACKEND_URL, {
            signal: controller.signal,
            headers: { "Accept": "application/json" }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !Array.isArray(data.processes) || data.processes.length === 0) {
            throw new Error(data.error || "No processes returned");
        }

        populateTableWithLiveProcesses(data.processes);

    } catch (err) {
        console.warn("Live System Mode backend unavailable:", err);
        showLiveBackendAlert("Live System Mode unavailable. Start the local Python backend to detect running processes.");
        if (!isLiveModeActive) {
            updateLiveStatus("Manual Mode", "manual");
        }
    } finally {
        if (detectBtn) detectBtn.disabled = false;
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

function populateTableWithLiveProcesses(processes) {
    clearAllProcessRows();
    isLiveModeActive = true;
    updateTableHeadersForMode(true);

    processes.forEach(p => {
        addProcessRow(
            p.name,
            p.at !== undefined ? p.at : 0,
            p.estimated_bt || 1,
            p.simulation_priority || 1,
            {
                pid: p.pid,
                cpu_percent: p.cpu_percent,
                status: p.status
            }
        );
    });

    updateLiveStatus(`${processes.length} live processes loaded`, "live");

    // Automatically run simulation on the detected live processes
    runSimulation();
}

function switchToManualMode() {
    isLiveModeActive = false;
    updateTableHeadersForMode(false);
    updateLiveStatus("Manual Mode", "manual");
    hideLiveBackendAlert();
    loadExampleData();
}

// ==============================================================================
// 8. Initialization & Event Listeners
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial State: Load Example Data
    loadExampleData();
    updateAlgorithmUI();

    // 2. Algorithm Selector Radio Changes
    const algoRadios = document.querySelectorAll('input[name="algorithm"]');
    algoRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            updateAlgorithmUI();
            clearValidationError();
        });
    });

    // 3. Action Buttons
    const addBtn = document.getElementById("btn-add-process");
    if (addBtn) addBtn.addEventListener("click", () => {
        addProcessRow();
        clearValidationError();
    });

    const removeBtn = document.getElementById("btn-remove-last");
    if (removeBtn) removeBtn.addEventListener("click", () => {
        removeLastProcessRow();
    });

    const clearBtn = document.getElementById("btn-clear-all");
    if (clearBtn) clearBtn.addEventListener("click", () => {
        clearAllProcessRows();
    });

    const loadBtn = document.getElementById("btn-load-example");
    if (loadBtn) loadBtn.addEventListener("click", () => {
        loadExampleData();
    });

    const runBtn = document.getElementById("btn-run-simulation");
    if (runBtn) runBtn.addEventListener("click", () => {
        runSimulation();
    });

    const compareBtn = document.getElementById("btn-compare-all");
    if (compareBtn) compareBtn.addEventListener("click", () => {
        runSimulation();
        const compSection = document.getElementById("comparison-section");
        if (compSection) {
            compSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });

    // 4. Alert Close Button
    const alertCloseBtn = document.getElementById("alert-close-btn");
    if (alertCloseBtn) {
        alertCloseBtn.addEventListener("click", () => {
            clearValidationError();
        });
    }

    // 5. Live System Mode Action Buttons
    const detectBtn = document.getElementById("btn-detect-processes");
    if (detectBtn) detectBtn.addEventListener("click", () => {
        detectRunningProcesses();
    });

    const refreshBtn = document.getElementById("btn-refresh-processes");
    if (refreshBtn) refreshBtn.addEventListener("click", () => {
        detectRunningProcesses();
    });

    const switchManualBtn = document.getElementById("btn-switch-manual");
    if (switchManualBtn) switchManualBtn.addEventListener("click", () => {
        switchToManualMode();
    });

    const backendAlertCloseBtn = document.getElementById("backend-alert-close-btn");
    if (backendAlertCloseBtn) backendAlertCloseBtn.addEventListener("click", () => {
        hideLiveBackendAlert();
    });
});
