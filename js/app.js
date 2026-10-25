/* ==========================================================
   VOLT TRAINING
   app.js — Main Application Controller
   Version 1.6
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
    restoreTimer
} from "./timers.js";

import {
    initPlanner,
    renderPlanner
} from "./planner.js";


/* ==========================================================
   1. APPLICATION STATE
========================================================== */

export const VOLT = {

    version: "1.6.0",

    state: null,

    currentScreen: "home",

    initialized: false,

    screens: [
        "home",
        "workout",
        "planner",
        "history",
        "programs"
    ],

    // Shared persistence for other modules.
    saveData

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

        // Load saved application data.
        VOLT.state = await loadData();

        // Make application state available to modules.
        window.VOLT = VOLT;

        // Register workout event handlers.
        registerWorkoutHandlers(VOLT);

        // Initialise the activity planner.
        initPlanner(VOLT);

        // Restore an unfinished workout if necessary.
        if (VOLT.state.activeWorkout) {

            resumeWorkout(VOLT);

            restoreTimer(VOLT);

        }

        // Render initial application screens.
        refreshApp();

        // Show dashboard.
        showTab("home");

        // Register service worker.
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

        console.warn(
            "Unknown screen:",
            screenName
        );

        return;

    }

    VOLT.currentScreen = screenName;

    // Hide all screens.
    document.querySelectorAll(".screen").forEach(
        screen => {

            screen.classList.remove("active");

        }
    );

    // Display selected screen.
    const selectedScreen = document.getElementById(
        screenName
    );

    if (selectedScreen) {

        selectedScreen.classList.add("active");

    }

    // Update navigation buttons.
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

    // Focus mode hides bottom navigation.
    const focusMode =
        screenName === "workout" &&
        Boolean(VOLT.state?.activeWorkout);

    document.body.classList.toggle(
        "focus-mode",
        focusMode
    );

    // Update selected screen.
    switch (screenName) {

        case "home":

            renderDashboard();

            break;

        case "workout":

            renderWorkout(VOLT);

            break;

        case "planner":

            renderPlanner();

            break;

        case "history":

            renderHistory(VOLT);

            break;

        case "programs":

            renderPrograms(VOLT);

            break;

    }

    // Return to top of screen.
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

    const currentDayIndex =
        state.currentDayIndex ?? 0;

    const currentCycle =
        state.currentCycle ?? 1;

    const currentDay =
        program.days[currentDayIndex];

    if (!currentDay) {

        renderEmptyDashboard();

        return;

    }

    // Current cycle.
    setText(
        "cyclePill",
        `CYCLE ${currentCycle}`
    );

    // Current day.
    setText(
        "dayIndicator",
        `DAY ${currentDayIndex + 1} OF ${program.days.length}`
    );

    // Next workout name.
    setText(
        "nextName",
        currentDay.name
    );

    // Number of exercises.
    const exerciseCount =
        currentDay.exercises?.length ?? 0;

    setText(
        "nextInfo",
        `${exerciseCount} exercises · ${program.name}`
    );

    // Statistics.
    setText(
        "cyclesDone",
        state.completedCycles ?? 0
    );

    setText(
        "workoutsDone",
        state.history?.length ?? 0
    );

    // Update workout progress.
    renderCycleProgress();

    // Update upcoming workouts.
    renderUpcomingWorkouts();

    // Update start button.
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

    setText(
        "cyclesDone",
        VOLT.state?.completedCycles ?? 0
    );

    setText(
        "workoutsDone",
        VOLT.state?.history?.length ?? 0
    );

    const dots = document.getElementById(
        "dots"
    );

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

    const container = document.getElementById(
        "dots"
    );

    if (!container) {
        return;
    }

    const state = VOLT.state;

    if (!state?.program?.days?.length) {

        container.innerHTML = "";

        return;

    }

    const totalDays =
        state.program.days.length;

    const currentIndex =
        state.currentDayIndex ?? 0;

    container.innerHTML = "";

    for (
        let index = 0;
        index < totalDays;
        index++
    ) {

        const dot = document.createElement(
            "span"
        );

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

    if (!state?.program?.days?.length) {

        container.innerHTML = `
            <div class="empty">
                No upcoming workouts.
            </div>
        `;

        return;

    }

    const days = state.program.days;

    const currentIndex =
        state.currentDayIndex ?? 0;

    container.innerHTML = "";

    for (
        let offset = 0;
        offset < days.length;
        offset++
    ) {

        const index =
            (currentIndex + offset) % days.length;

        const day = days[index];

        const item = document.createElement(
            "button"
        );

        item.type = "button";

        item.className = "workout-item";

        // Reset browser button styles while preserving
        // the existing workout-item layout.
        item.style.cssText = `
            width: 100%;
            text-align: left;
            cursor: pointer;
            color: inherit;
            font: inherit;
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 0;
            appearance: none;
            -webkit-appearance: none;
        `;

        const number = document.createElement(
            "div"
        );

        number.className = "num";

        number.textContent = index + 1;

        const details = document.createElement(
            "div"
        );

        const title = document.createElement(
            "strong"
        );

        title.textContent = day.name;

        const subtitle = document.createElement(
            "span"
        );

        subtitle.textContent =
            `${day.exercises?.length ?? 0} exercises` +
            (offset === 0 ? " · UP NEXT" : "");

        details.appendChild(title);

        details.appendChild(subtitle);

        const arrow = document.createElement(
            "span"
        );

        arrow.textContent = "›";

        arrow.style.cssText = `
            margin-left: auto;
            font-size: 24px;
            opacity: 0.65;
        `;

        item.appendChild(number);

        item.appendChild(details);

        item.appendChild(arrow);

        item.addEventListener(
            "click",
            () => {

                openWorkoutPreview(index);

            }
        );

        container.appendChild(item);

    }

}


/* ==========================================================
   8. WORKOUT PREVIEW
========================================================== */

function openWorkoutPreview(dayIndex) {

    const day =
        VOLT.state?.program?.days?.[dayIndex];

    if (!day) {
        return;
    }

    closeWorkoutPreview();

    const overlay = document.createElement(
        "div"
    );

    overlay.id = "voltWorkoutPreview";

    overlay.setAttribute(
        "role",
        "dialog"
    );

    overlay.setAttribute(
        "aria-modal",
        "true"
    );

    overlay.setAttribute(
        "aria-label",
        `${day.name} workout preview`
    );

    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
    `;

    const panel = document.createElement(
        "div"
    );

    panel.style.cssText = `
        background: #1b1d21;
        color: #ffffff;
        width: 100%;
        max-width: 520px;
        max-height: 88dvh;
        overflow-y: auto;
        border: 1px solid #3a3d42;
        border-radius: 20px;
        padding: 22px;
        box-sizing: border-box;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;

    const heading = document.createElement(
        "div"
    );

    heading.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        margin-bottom: 20px;
    `;

    const headingText = document.createElement(
        "div"
    );

    const eyebrow = document.createElement(
        "div"
    );

    eyebrow.textContent =
        `WORKOUT ${dayIndex + 1}`;

    eyebrow.style.cssText = `
        color: #baff4c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 2px;
        margin-bottom: 8px;
    `;

    const title = document.createElement(
        "h2"
    );

    title.textContent = day.name;

    title.style.cssText = `
        font-size: 21px;
        line-height: 1.3;
        margin: 0;
    `;

    headingText.append(
        eyebrow,
        title
    );

    const closeButton = document.createElement(
        "button"
    );

    closeButton.type = "button";

    closeButton.textContent = "×";

    closeButton.setAttribute(
        "aria-label",
        "Close preview"
    );

    closeButton.style.cssText = `
        background: #303338;
        color: white;
        border: none;
        border-radius: 10px;
        width: 36px;
        height: 36px;
        font-size: 25px;
        cursor: pointer;
        flex-shrink: 0;
    `;

    closeButton.addEventListener(
        "click",
        closeWorkoutPreview
    );

    heading.append(
        headingText,
        closeButton
    );

    panel.appendChild(heading);

    // Warm-up section.
    if (day.warmup?.length) {

        panel.appendChild(
            createPreviewSection(
                "WARM-UP",
                day.warmup
            )
        );

    }

    // Main workout section.
    if (day.exercises?.length) {

        panel.appendChild(
            createPreviewSection(
                "MAIN WORKOUT",
                day.exercises
            )
        );

    }

    overlay.appendChild(panel);

    overlay.addEventListener(
        "click",
        event => {

            if (event.target === overlay) {

                closeWorkoutPreview();

            }

        }
    );

    document.body.appendChild(overlay);

    document.addEventListener(
        "keydown",
        handlePreviewEscape
    );

    closeButton.focus();

}


/* ==========================================================
   9. WORKOUT PREVIEW SECTIONS
========================================================== */

function createPreviewSection(
    label,
    exercises
) {

    const section = document.createElement(
        "section"
    );

    section.style.marginBottom = "22px";

    const heading = document.createElement(
        "h3"
    );

    heading.textContent = label;

    heading.style.cssText = `
        color: #baff4c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        margin: 0 0 12px;
    `;

    section.appendChild(heading);

    exercises.forEach(
        (exercise, index) => {

            const row = document.createElement(
                "div"
            );

            row.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 11px 0;
                border-bottom: 1px solid #33363b;
            `;

            const number = document.createElement(
                "span"
            );

            number.textContent =
                String(index + 1).padStart(2, "0");

            number.style.cssText = `
                color: #81868c;
                font-size: 12px;
                font-weight: 700;
                min-width: 24px;
                padding-top: 3px;
            `;

            const details = document.createElement(
                "div"
            );

            const name = document.createElement(
                "div"
            );

            name.textContent = exercise.name;

            name.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                line-height: 1.4;
            `;

            const prescription = document.createElement(
                "div"
            );

            const sets =
                exercise.sets ?? 1;

            const reps =
                exercise.reps ?? "—";

            prescription.textContent =
                `${sets} × ${reps}` +
                (
                    exercise.type === "time"
                        ? " sec"
                        : ""
                ) +
                (
                    exercise.perSide
                        ? " / side"
                        : ""
                );

            prescription.style.cssText = `
                color: #a5a9ae;
                font-size: 12px;
                margin-top: 4px;
            `;

            details.append(
                name,
                prescription
            );

            row.append(
                number,
                details
            );

            section.appendChild(row);

        }
    );

    return section;

}


/* ==========================================================
   10. CLOSE WORKOUT PREVIEW
========================================================== */

function handlePreviewEscape(event) {

    if (event.key === "Escape") {

        closeWorkoutPreview();

    }

}

function closeWorkoutPreview() {

    document.getElementById(
        "voltWorkoutPreview"
    )?.remove();

    document.removeEventListener(
        "keydown",
        handlePreviewEscape
    );

}


/* ==========================================================
   11. START / RESUME BUTTON
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

        button.textContent =
            "▶ RESUME WORKOUT";

    } else {

        button.textContent =
            "▶ START WORKOUT";

    }

    button.onclick = handleStartWorkout;

}


/* ==========================================================
   12. START WORKOUT
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
   13. REFRESH APPLICATION
========================================================== */

export function refreshApp() {

    if (!VOLT.state) {
        return;
    }

    renderDashboard();

    renderHistory(VOLT);

    renderPrograms(VOLT);

    renderPlanner();

}


/* ==========================================================
   14. SAVE APPLICATION STATE
========================================================== */

export async function persistState() {

    if (!VOLT.state) {
        return;
    }

    try {

        await saveData(VOLT.state);

    } catch (error) {

        console.error(
            "Failed to save VOLT data:",
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
   15. APPLICATION ERROR MESSAGE
========================================================== */

function showAppError(message) {

    let errorBox = document.getElementById(
        "appError"
    );

    if (!errorBox) {

        errorBox = document.createElement(
            "div"
        );

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
   16. TEXT HELPER
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
   17. SERVICE WORKER REGISTRATION
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
   18. HANDLE APP VISIBILITY
========================================================== */

document.addEventListener(
    "visibilitychange",
    () => {

        if (!VOLT.initialized) {
            return;
        }

        if (
            document.visibilityState === "visible"
        ) {

            // Recalculate timers after background suspension.
            restoreTimer(VOLT);

            // Refresh the current screen.
            switch (VOLT.currentScreen) {

                case "workout":

                    renderWorkout(VOLT);

                    break;

                case "planner":

                    renderPlanner();

                    break;

                case "home":

                    renderDashboard();

                    break;

            }

        }

    }
);


/* ==========================================================
   19. HANDLE PAGE EXIT
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
   20. GLOBAL HTML EVENT HANDLERS
========================================================== */

// Compatibility with index.html inline handlers.

window.showTab = showTab;

window.startWorkout = handleStartWorkout;

window.exportCSV = () => {

    exportCSV(VOLT.state);

};

window.exportJSON = () => {

    exportJSON(VOLT.state);

};

window.restoreBackup = async (event) => {

    const restoredState =
        await restoreBackup(event);

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
   21. START APPLICATION
========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);