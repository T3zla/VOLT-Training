/* ==========================================================
   VOLT TRAINING
   app.js — Main Application Controller
   Version 1.2
   ========================================================== */

import {
    loadData,
    saveData,
    exportCSV,
    exportJSON,
    restoreBackup
} from "./storage.js";

import {
    startWorkout,
    renderWorkout,
    resumeWorkout,
    renderHistory,
    registerWorkoutHandlers
} from "./workouts.js";

import {
    renderPrograms,
    importProgram,
    loadCSV
} from "./programs.js";

import {
    restoreTimer,
    stopTimer
} from "./timers.js";


/* ==========================================================
   1. APPLICATION STATE
========================================================== */

export const VOLT = {

    version: "1.4.0",

    state: null,

    currentScreen: "home",

    initialized: false,

    screens: [
        "home",
        "workout",
        "history",
        "programs"
    ]

};


/* ==========================================================
   2. INITIALIZE APPLICATION
========================================================== */

async function initializeApp() {

    if (VOLT.initialized) {
        return;
    }

    console.log(
        `VOLT Training v${VOLT.version} initializing...`
    );

    try {

        // Load saved application data
        VOLT.state = await loadData();

        // Make application state available to modules
        window.VOLT = VOLT;

        // Register workout event handlers
        registerWorkoutHandlers(VOLT);

        // Restore an unfinished workout if necessary
        if (VOLT.state.activeWorkout) {

            resumeWorkout(VOLT);

            restoreTimer(VOLT);

        }

        // Render initial application screens
        refreshApp();

        // Show dashboard
        showTab("home");

        // Register service worker
        registerServiceWorker();

        VOLT.initialized = true;

        console.log(
            "VOLT Training initialized successfully."
        );

    } catch (error) {

        console.error(
            "VOLT initialization failed:",
            error
        );

        showAppError(
            "VOLT couldn't load your saved data. " +
            "Please reload the application. " +
            "Do not clear your browser storage."
        );

    }

}


/* ==========================================================
   3. SCREEN NAVIGATION
========================================================== */

export function showTab(screenName) {

    if (!VOLT.screens.includes(screenName)) {
        console.warn("Unknown screen:", screenName);
        return;
    }

    VOLT.currentScreen = screenName;

    // Hide all screens
    document.querySelectorAll(".screen").forEach(
        screen => {
            screen.classList.remove("active");
        }
    );

    // Display selected screen
    const selectedScreen = document.getElementById(
        screenName
    );

    if (selectedScreen) {
        selectedScreen.classList.add("active");
    }

    // Update navigation buttons
    document.querySelectorAll(".tab").forEach(
        button => {

            const isActive =
                button.dataset.tab === screenName;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-current",
                isActive ? "page" : "false"
            );

        }
    );

    // Focus mode hides bottom navigation
    const focusMode =
        screenName === "workout" &&
        Boolean(VOLT.state?.activeWorkout);

    document.body.classList.toggle(
        "focus-mode",
        focusMode
    );

    // Update selected screen
    switch (screenName) {

        case "home":
            renderDashboard();
            break;

        case "workout":
            renderWorkout(VOLT);
            break;

        case "history":
            renderHistory(VOLT);
            break;

        case "programs":
            renderPrograms(VOLT);
            break;

    }

    // Return to top of screen
    window.scrollTo({
        top: 0,
        behavior: "instant"
    });

}


/* ==========================================================
   4. DASHBOARD
========================================================== */

export function renderDashboard() {

    const state = VOLT.state;

    if (!state) {
        return;
    }

    const program = state.program;

    if (!program || !program.days?.length) {
        renderEmptyDashboard();
        return;
    }

    const currentDayIndex = state.currentDayIndex ?? 0;

    const currentCycle = state.currentCycle ?? 1;

    const currentDay = program.days[currentDayIndex];

    if (!currentDay) {
        renderEmptyDashboard();
        return;
    }

    // Current cycle
    setText(
        "cyclePill",
        `CYCLE ${currentCycle}`
    );

    // Current day
    setText(
        "dayIndicator",
        `DAY ${currentDayIndex + 1} OF ${program.days.length}`
    );

    // Next workout name
    setText(
        "nextName",
        currentDay.name
    );

    // Number of exercises
    const exerciseCount =
        currentDay.exercises?.length ?? 0;

    setText(
        "nextInfo",
        `${exerciseCount} exercises · ${program.name}`
    );

    // Statistics
    setText(
        "cyclesDone",
        state.completedCycles ?? 0
    );

    setText(
        "workoutsDone",
        state.history?.length ?? 0
    );

    // Update workout progress
    renderCycleProgress();

    // Update upcoming workouts
    renderUpcomingWorkouts();

    // Update start button
    updateStartButton();

}


/* ==========================================================
   5. EMPTY DASHBOARD
========================================================== */

function renderEmptyDashboard() {

    setText(
        "cyclePill",
        "NO ACTIVE PROGRAM"
    );

    setText(
        "dayIndicator",
        ""
    );

    setText(
        "nextName",
        "Ready to train?"
    );

    setText(
        "nextInfo",
        "Import your first training program."
    );

    const dots = document.getElementById("dots");

    if (dots) {
        dots.innerHTML = "";
    }

    const upcoming = document.getElementById(
        "upcoming"
    );

    if (upcoming) {

        upcoming.innerHTML = `
            <div class="empty">
                No training program loaded.
            </div>
        `;

    }

    const startButton = document.getElementById(
        "startWorkoutBtn"
    );

    if (startButton) {

        startButton.textContent = "IMPORT PROGRAM";

        startButton.onclick = () => {
            showTab("programs");
        };

    }

}


/* ==========================================================
   6. CYCLE PROGRESS INDICATORS
========================================================== */

function renderCycleProgress() {

    const container = document.getElementById("dots");

    if (!container) {
        return;
    }

    const state = VOLT.state;

    const totalDays = state.program.days.length;

    const currentIndex = state.currentDayIndex ?? 0;

    container.innerHTML = "";

    for (let index = 0; index < totalDays; index++) {

        const dot = document.createElement("span");

        dot.classList.add("dot");

        if (index < currentIndex) {

            dot.classList.add("done");

        } else if (index === currentIndex) {

            dot.classList.add("current");

        }

        dot.setAttribute(
            "aria-label",
            `Workout ${index + 1}`
        );

        container.appendChild(dot);

    }

}


/* ==========================================================
   7. UPCOMING WORKOUTS
========================================================== */

function renderUpcomingWorkouts() {

    const container = document.getElementById(
        "upcoming"
    );

    if (!container) {
        return;
    }

    const state = VOLT.state;

    const days = state.program.days;

    const currentIndex = state.currentDayIndex ?? 0;

    container.innerHTML = "";

    // Display the next workouts in rotation
    for (let offset = 0; offset < days.length; offset++) {

        const index = (
            currentIndex + offset
        ) % days.length;

        const day = days[index];

        const item = document.createElement("div");

        item.className = "workout-item";

        const number = document.createElement("div");

        number.className = "num";

        number.textContent = index + 1;

        const details = document.createElement("div");

        const title = document.createElement("strong");

        title.textContent = day.name;

        const subtitle = document.createElement("span");

        const exerciseCount =
            day.exercises?.length ?? 0;

        subtitle.textContent =
            `${exerciseCount} exercises` +
            (offset === 0 ? " · UP NEXT" : "");

        details.appendChild(title);
        details.appendChild(subtitle);

        item.appendChild(number);
        item.appendChild(details);

        container.appendChild(item);

    }

}


/* ==========================================================
   8. START / RESUME BUTTON
========================================================== */

function updateStartButton() {

    const button = document.getElementById(
        "startWorkoutBtn"
    );

    if (!button) {
        return;
    }

    const activeWorkout =
        VOLT.state.activeWorkout;

    if (activeWorkout) {

        button.textContent = "▶ RESUME WORKOUT";

    } else {

        button.textContent = "▶ START WORKOUT";

    }

    button.onclick = handleStartWorkout;

}


/* ==========================================================
   9. START WORKOUT
========================================================== */

export function handleStartWorkout() {

    if (!VOLT.state?.program?.days?.length) {

        showTab("programs");

        return;

    }

    if (VOLT.state.activeWorkout) {

        resumeWorkout(VOLT);

    } else {

        startWorkout(VOLT);

    }

    showTab("workout");

}


/* ==========================================================
   10. REFRESH APPLICATION
========================================================== */

export function refreshApp() {

    renderDashboard();

    renderHistory(VOLT);

    renderPrograms(VOLT);

}


/* ==========================================================
   11. SAVE APPLICATION STATE
========================================================== */

export async function persistState() {

    if (!VOLT.state) {
        return;
    }

    try {

        await saveData(VOLT.state);

    } catch (error) {

        console.error(
            "Failed to save workout data:",
            error
        );

        showAppError(
            "Your latest changes could not be saved. " +
            "Please export a backup before closing VOLT."
        );

        throw error;

    }

}


/* ==========================================================
   12. APPLICATION ERROR MESSAGE
========================================================== */

function showAppError(message) {

    let errorBox = document.getElementById(
        "appError"
    );

    if (!errorBox) {

        errorBox = document.createElement("div");

        errorBox.id = "appError";

        errorBox.setAttribute(
            "role",
            "alert"
        );

        errorBox.style.cssText = `
            position: fixed;
            top: calc(15px + env(safe-area-inset-top));
            left: 15px;
            right: 15px;
            z-index: 9999;
            max-width: 510px;
            margin: 0 auto;
            padding: 16px;
            border: 1px solid #ff7777;
            border-radius: 14px;
            background: #3a2025;
            color: #ffffff;
            font-size: 13px;
            line-height: 1.5;
            box-shadow: 0 10px 30px #0008;
        `;

        document.body.appendChild(errorBox);

    }

    errorBox.textContent = message;

}


/* ==========================================================
   13. TEXT HELPER
========================================================== */

function setText(elementId, value) {

    const element = document.getElementById(
        elementId
    );

    if (element) {
        element.textContent = value;
    }

}


/* ==========================================================
   14. SERVICE WORKER REGISTRATION
========================================================== */

async function registerServiceWorker() {

    if (!("serviceWorker" in navigator)) {
        return;
    }

    try {

        const registration =
            await navigator.serviceWorker.register(
                "./service-worker.js",
                {
                    scope: "./"
                }
            );

        console.log(
            "VOLT service worker registered:",
            registration.scope
        );

    } catch (error) {

        console.warn(
            "Service worker registration failed:",
            error
        );

    }

}


/* ==========================================================
   15. HANDLE APP VISIBILITY
========================================================== */

document.addEventListener(
    "visibilitychange",
    () => {

        if (!VOLT.initialized) {
            return;
        }

        if (document.visibilityState === "visible") {

            // Recalculate timer after background suspension
            restoreTimer(VOLT);

            // Refresh current screen
            if (VOLT.currentScreen === "workout") {

                renderWorkout(VOLT);

            }

        }

    }
);


/* ==========================================================
   16. HANDLE PAGE EXIT
========================================================== */

window.addEventListener(
    "pagehide",
    () => {

        if (!VOLT.initialized) {
            return;
        }

        // State changes are saved as they occur.
        // Do not rely on asynchronous saves during pagehide.

    }
);


/* ==========================================================
   17. GLOBAL HTML EVENT HANDLERS
========================================================== */

// Temporary compatibility with index.html inline handlers.
// We'll remove these when all modules are complete.

window.showTab = showTab;

window.startWorkout = handleStartWorkout;

window.exportCSV = () => {
    exportCSV(VOLT.state);
};

window.exportJSON = () => {
    exportJSON(VOLT.state);
};

window.restoreBackup = async (event) => {

    const restoredState = await restoreBackup(event);

    if (restoredState) {

        VOLT.state = restoredState;

        refreshApp();

        showTab("home");

    }

};

window.importProgram = async () => {

    await importProgram(VOLT);

    refreshApp();

};

window.loadCSV = loadCSV;


/* ==========================================================
   18. START APPLICATION
========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);