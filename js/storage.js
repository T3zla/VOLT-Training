/* ==========================================================
   VOLT TRAINING
   storage.js — Persistent Storage & Data Export
   Version 1.2
   ========================================================== */


/* ==========================================================
   1. STORAGE CONFIGURATION
========================================================== */

const STORAGE_KEY = "volt_training_v1";

const STORAGE_VERSION = 1;

const BACKUP_FORMAT = "VOLT_TRAINING_BACKUP";


/* ==========================================================
   2. DEFAULT APPLICATION STATE
========================================================== */

function createDefaultState() {

    return {

        version: STORAGE_VERSION,

        program: null,

        currentDayIndex: 0,

        currentCycle: 1,

        completedCycles: 0,

        activeWorkout: null,

        history: [],

        plannerEntries[],

        settings: {
            defaultRest: 90,
            weightUnit: "kg",
            soundEnabled: true,
            vibrationEnabled: true
        },

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString()

    };

}


/* ==========================================================
   3. LOAD APPLICATION DATA
========================================================== */

export async function loadData() {

    try {

        const savedData = localStorage.getItem(
            STORAGE_KEY
        );

        // First-time installation
        if (!savedData) {

            const defaultState =
                createDefaultState();

            // Try loading the bundled program
            const defaultProgram =
                await loadDefaultProgram();

            if (defaultProgram) {

                defaultState.program =
                    defaultProgram;

            }

            await saveData(defaultState);

            return defaultState;

        }

        const parsedData = JSON.parse(
            savedData
        );

        const validatedState =
            normalizeState(parsedData);

        return validatedState;

    } catch (error) {

        console.error(
            "Failed to load VOLT data:",
            error
        );

        /*
           IMPORTANT:

           If stored data exists but is invalid,
           we must NOT overwrite it automatically.

           Doing so could permanently erase the
           user's workout history.
        */

        throw new Error(
            "Your saved VOLT data could not be loaded. " +
            "Your existing data has not been overwritten."
        );

    }

}


/* ==========================================================
   4. SAVE APPLICATION DATA
========================================================== */

export async function saveData(state) {

    if (!state || typeof state !== "object") {

        throw new Error(
            "Cannot save invalid application state."
        );

    }

    const validatedState =
        normalizeState(state);

    validatedState.updatedAt =
        new Date().toISOString();

    try {

        const serialized =
            JSON.stringify(validatedState);

        localStorage.setItem(
            STORAGE_KEY,
            serialized
        );

        // Keep the in-memory state timestamp aligned.
        state.updatedAt =
            validatedState.updatedAt;

        return true;

    } catch (error) {

        console.error(
            "Failed to save VOLT data:",
            error
        );

        throw new Error(
            "VOLT could not save your workout data. " +
            "Your device may be running low on storage."
        );

    }

}


/* ==========================================================
   5. LOAD BUNDLED DEFAULT PROGRAM
========================================================== */

async function loadDefaultProgram() {

    try {

        const response = await fetch(
            "./data/default-program.json",
            {
                cache: "no-cache"
            }
        );

        if (!response.ok) {

            console.warn(
                "Default program file not found."
            );

            return null;

        }

        const program =
            await response.json();

        if (
            !program ||
            !Array.isArray(program.days) ||
            program.days.length === 0
        ) {

            console.warn(
                "Default program is invalid."
            );

            return null;

        }

        return program;

    } catch (error) {

        console.warn(
            "Could not load default program:",
            error
        );

        return null;

    }

}


/* ==========================================================
   6. NORMALIZE APPLICATION STATE
========================================================== */

function normalizeState(data) {

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {

        throw new Error(
            "Application data must be an object."
        );

    }

    const defaults =
        createDefaultState();

    const state = {

        ...defaults,
        ...data,

        settings: {
            ...defaults.settings,
            ...(data.settings ?? {})
        }

    };

    // Validate version
    if (
        typeof state.version !== "number" ||
        state.version > STORAGE_VERSION
    ) {

        throw new Error(
            "Unsupported VOLT storage version."
        );

    }

    // Planner data: support existing VOLT installations.

    if (!Array.isArray(state.plannerEntries)) {
        state.plannerEntries = [];
    }

    // Validate history
    if (!Array.isArray(state.history)) {

        throw new Error(
            "Workout history must be an array."
        );

    }

    // Validate active program
    if (state.program !== null) {

        validateProgramStructure(
            state.program
        );

    }

    // Validate active workout
    if (
        state.activeWorkout !== null &&
        (
            typeof state.activeWorkout !== "object" ||
            Array.isArray(state.activeWorkout)
        )
    ) {

        throw new Error(
            "Invalid active workout data."
        );

    }

    // Validate current day index
    if (
        !Number.isInteger(state.currentDayIndex) ||
        state.currentDayIndex < 0
    ) {

        state.currentDayIndex = 0;

    }

    // Validate current cycle
    if (
        !Number.isInteger(state.currentCycle) ||
        state.currentCycle < 1
    ) {

        state.currentCycle = 1;

    }

    // Validate completed cycles
    if (
        !Number.isInteger(state.completedCycles) ||
        state.completedCycles < 0
    ) {

        state.completedCycles = 0;

    }

    // Ensure day index is valid
    if (
        state.program &&
        state.currentDayIndex >=
        state.program.days.length
    ) {

        state.currentDayIndex = 0;

    }

    return state;

}


/* ==========================================================
   7. VALIDATE PROGRAM STRUCTURE
========================================================== */

function validateProgramStructure(program) {

    if (
        typeof program !== "object" ||
        !Array.isArray(program.days) ||
        program.days.length === 0
    ) {

        throw new Error(
            "Invalid training program structure."
        );

    }

    for (const day of program.days) {

        if (
            typeof day.name !== "string" ||
            !Array.isArray(day.exercises)
        ) {

            throw new Error(
                "Invalid training day structure."
            );

        }

        for (const exercise of day.exercises) {

            if (
                typeof exercise.name !== "string" ||
                !exercise.name.trim()
            ) {

                throw new Error(
                    "Invalid exercise in training program."
                );

            }

        }

    }

}


/* ==========================================================
   8. EXPORT WORKOUT HISTORY AS CSV
========================================================== */

export function exportCSV(state) {

    if (!state) {
        return;
    }

    const history =
        state.history ?? [];

    if (!history.length) {

        alert(
            "There are no completed workouts to export yet."
        );

        return;

    }

    const headers = [
        "Workout ID",
        "Date",
        "Program",
        "Cycle",
        "Day",
        "Exercise",
        "Set",
        "Weight (kg)",
        "Reps",
        "Seconds",
        "Completed At"
    ];

    const rows = [
        headers
    ];

    history.forEach(workout => {

        const exercises =
            workout.exercises ?? [];

        exercises.forEach(exercise => {

            const loggedSets =
                exercise.loggedSets ?? [];

            loggedSets.forEach(set => {

                rows.push([

                    workout.id ?? "",

                    workout.completedAt ?? "",

                    workout.programName ?? "",

                    workout.cycle ?? "",

                    workout.dayName ?? "",

                    exercise.name ?? "",

                    set.set ?? "",

                    set.weight ?? "",

                    set.reps ?? "",

                    set.seconds ?? "",

                    set.completedAt ?? ""

                ]);

            });

        });

    });

    const csv = rows
        .map(row => row.map(
            escapeCSV
        ).join(","))
        .join("\r\n");

    downloadFile(
        csv,
        createFilename("volt-workout-history", "csv"),
        "text/csv;charset=utf-8"
    );

}


/* ==========================================================
   9. ESCAPE CSV VALUES
========================================================== */

function escapeCSV(value) {

    const text =
        String(value ?? "");

    // Prevent spreadsheet formula injection.
    const safeText = /^[\s]*[=+\-@\t\r]/.test(text)
        ? "'" + text
        : text;

    if (
        safeText.includes(",") ||
        safeText.includes('"') ||
        safeText.includes("\n") ||
        safeText.includes("\r")
    ) {

        return (
            '"' +
            safeText.replace(/"/g, '""') +
            '"'
        );

    }

    return safeText;

}


/* ==========================================================
   10. EXPORT COMPLETE JSON BACKUP
========================================================== */

export function exportJSON(state) {

    if (!state) {
        return;
    }

    const backup = {

        format: BACKUP_FORMAT,

        backupVersion: 1,

        exportedAt:
            new Date().toISOString(),

        appVersion: "1.2.0",

        data: structuredClone(state)

    };

    const json = JSON.stringify(
        backup,
        null,
        2
    );

    downloadFile(
        json,
        createFilename("volt-full-backup", "json"),
        "application/json"
    );

}


/* ==========================================================
   11. RESTORE JSON BACKUP
========================================================== */

export async function restoreBackup(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return null;
    }

    try {

        const text =
            await file.text();

        const backup =
            JSON.parse(text);

        // Validate backup format
        if (
            backup.format !== BACKUP_FORMAT ||
            !backup.data
        ) {

            throw new Error(
                "This is not a valid VOLT backup file."
            );

        }

        if (backup.backupVersion !== 1) {

            throw new Error(
                "Unsupported backup version."
            );

        }

        const restoredState =
            normalizeState(backup.data);

        /*
           Restoring replaces:
           - Current program
           - Current cycle
           - Workout history
           - Active workout
           - Settings

           We therefore require confirmation.
        */

        const confirmed =
            window.confirm(
                "Restore this VOLT backup?\n\n" +
                "This will replace your current program, " +
                "workout history, and active workout.\n\n" +
                "Export a backup of your current data first " +
                "if you want to keep it."
            );

        if (!confirmed) {
            return null;
        }

        await saveData(restoredState);

        alert(
            "VOLT backup restored successfully."
        );

        return restoredState;

    } catch (error) {

        console.error(
            "Backup restoration failed:",
            error
        );

        alert(
            "Could not restore backup:\n\n" +
            error.message
        );

        return null;

    } finally {

        // Allow the same backup to be selected again.
        event.target.value = "";

    }

}


/* ==========================================================
   12. DOWNLOAD FILE
========================================================== */

function downloadFile(
    content,
    filename,
    mimeType
) {

    const blob = new Blob(
        [content],
        {
            type: mimeType
        }
    );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    // Give the browser time to begin the download.
    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 60000);

}


/* ==========================================================
   13. GENERATE BACKUP FILENAMES
========================================================== */

function createFilename(
    prefix,
    extension
) {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return (
        `${prefix}-${year}-${month}-${day}.${extension}`
    );

}


/* ==========================================================
   14. STORAGE INFORMATION
========================================================== */

export function getStorageInfo() {

    const raw =
        localStorage.getItem(STORAGE_KEY);

    if (!raw) {

        return {
            exists: false,
            bytes: 0,
            kilobytes: 0
        };

    }

    const bytes =
        new Blob([raw]).size;

    return {

        exists: true,

        bytes,

        kilobytes:
            Math.round(bytes / 1024 * 100) / 100

    };

}


/* ==========================================================
   15. CHECK STORAGE AVAILABILITY
========================================================== */

export function isStorageAvailable() {

    const testKey =
        "__volt_storage_test__";

    try {

        localStorage.setItem(
            testKey,
            "1"
        );

        localStorage.removeItem(
            testKey
        );

        return true;

    } catch (error) {

        return false;

    }

}