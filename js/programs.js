/* ==========================================================
   VOLT TRAINING
   programs.js — Program Management & CSV Import
   Version 1.2
   ========================================================== */

import { saveData } from "./storage.js";


/* ==========================================================
   1. MODULE CONFIGURATION
========================================================== */

const REQUIRED_COLUMNS = [
    "day",
    "exercise",
    "sets",
    "reps"
];

const OPTIONAL_COLUMNS = [
    "rest",
    "type",
    "notes"
];

const DEFAULT_REST = 90;


/* ==========================================================
   2. RENDER PROGRAMS SCREEN
========================================================== */

export function renderPrograms(VOLT) {

    const state = VOLT.state;

    if (!state) {
        return;
    }

    const program = state.program;

    const nameElement =
        document.getElementById("programName");

    const metaElement =
        document.getElementById("programMeta");

    const detailsElement =
        document.getElementById("programDetails");

    if (!program || !program.days?.length) {

        if (nameElement) {
            nameElement.textContent = "No Active Program";
        }

        if (metaElement) {
            metaElement.textContent =
                "Import a program to begin training.";
        }

        if (detailsElement) {

            detailsElement.innerHTML = `
                <div class="card empty">
                    Your imported exercises will appear here.
                </div>
            `;

        }

        return;
    }

    const dayCount = program.days.length;

    const exerciseCount = program.days.reduce(
        (total, day) => total + day.exercises.length,
        0
    );

    if (nameElement) {
        nameElement.textContent = program.name;
    }

    if (metaElement) {

        metaElement.textContent =
            `${dayCount} rotating days · ` +
            `${exerciseCount} exercises`;

    }

    renderProgramDetails(program);

}


/* ==========================================================
   3. RENDER PROGRAM DETAILS
========================================================== */

function renderProgramDetails(program) {

    const container =
        document.getElementById("programDetails");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    program.days.forEach((day, dayIndex) => {

        const card = document.createElement("div");

        card.className = "card";

        const header = document.createElement("div");

        header.className = "row";

        const title = document.createElement("h3");

        title.textContent =
            `${dayIndex + 1}. ${day.name}`;

        const count = document.createElement("span");

        count.className = "small muted";

        count.textContent =
            `${day.exercises.length} exercises`;

        header.appendChild(title);
        header.appendChild(count);

        card.appendChild(header);

        if (day.warmup?.length) {
            const warmup = document.createElement('div');
            warmup.className = 'volt-program-warmup';
            const title = document.createElement('strong');
            title.textContent = `WARM-UP · ${day.warmup.length} movements`;
            warmup.appendChild(title);
            day.warmup.forEach(item => {
                const line = document.createElement('div');
                line.className = 'small muted';
                line.textContent = `${item.name} · ${item.sets} × ${item.reps} ${item.type === 'time' ? 'sec' : 'reps'}${item.perSide ? ' per side' : ''}`;
                warmup.appendChild(line);
            });
            card.appendChild(warmup);
        }

        day.exercises.forEach((exercise, index) => {

            const item = document.createElement("div");

            item.className = "workout-item";

            const number = document.createElement("div");

            number.className = "num";

            number.textContent = index + 1;

            const details = document.createElement("div");

            const exerciseName =
                document.createElement("strong");

            exerciseName.textContent = exercise.name;

            const prescription =
                document.createElement("span");

            const unit = isTimedExercise(exercise)
                ? "seconds"
                : "reps";

            prescription.textContent =
                `${exercise.sets} sets × ` +
                `${exercise.reps} ${unit} · ` +
                `${exercise.rest}s rest`;

            details.appendChild(exerciseName);
            details.appendChild(prescription);

            if (exercise.notes) {

                const notes =
                    document.createElement("span");

                notes.textContent = exercise.notes;

                details.appendChild(notes);

            }

            item.appendChild(number);
            item.appendChild(details);

            card.appendChild(item);

        });

        container.appendChild(card);

    });

}


/* ==========================================================
   4. HANDLE CSV FILE UPLOAD
========================================================== */

export async function loadCSV(event) {

    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    const textarea =
        document.getElementById("csvText");

    try {

        const text = await file.text();

        if (!text.trim()) {
            throw new Error("The selected CSV file is empty.");
        }

        if (textarea) {
            textarea.value = text;
        }

        showImportStatus(
            `Loaded "${file.name}". ` +
            "Review the program and select Import.",
            "success"
        );

    } catch (error) {

        showImportStatus(
            error.message,
            "error"
        );

    }

    // Allow the same file to be selected again.
    event.target.value = "";

}


/* ==========================================================
   5. IMPORT PROGRAM
========================================================== */

export async function importProgram(VOLT) {

    const textarea =
        document.getElementById("csvText");

    const csvText = textarea?.value.trim();

    if (!csvText) {

        showImportStatus(
            "Please upload a CSV file or paste a program.",
            "error"
        );

        return false;
    }

    try {

        const rows = parseCSV(csvText);

        const program = buildProgram(rows);

        validateProgram(program);

        const state = VOLT.state;

        if (state.activeWorkout) {

            const proceed = window.confirm(
                "You have an unfinished workout.\n\n" +
                "Importing a new program will discard " +
                "that unfinished workout.\n\n" +
                "Your completed workout history will remain."
            );

            if (!proceed) {
                return false;
            }

        }

        const previousState = structuredClone(state);

        // Replace only the active training program.
        state.program = program;

        // Reset the new program's rotation.
        state.currentDayIndex = 0;
        state.currentCycle = 1;
        state.completedCycles = 0;

        // Discard unfinished session, if confirmed.
        state.activeWorkout = null;

        // Preserve completed workout history.
        state.history = previousState.history ?? [];

        try {

            await saveData(state);

        } catch (error) {

            // Restore the previous state if saving fails.
            Object.keys(state).forEach(
                key => delete state[key]
            );

            Object.assign(state, previousState);

            throw error;

        }

        showImportStatus(
            `Successfully imported "${program.name}" ` +
            `with ${program.days.length} training days.`,
            "success"
        );

        renderPrograms(VOLT);

        return true;

    } catch (error) {

        console.error(
            "Program import failed:",
            error
        );

        showImportStatus(
            error.message,
            "error"
        );

        return false;

    }

}


/* ==========================================================
   6. BUILD PROGRAM FROM CSV
========================================================== */

function buildProgram(rows) {

    if (rows.length < 2) {

        throw new Error(
            "Your CSV needs a header row and at least " +
            "one exercise."
        );

    }

    const headers = rows[0].map(
        header => header.trim().toLowerCase()
    );

    REQUIRED_COLUMNS.forEach(column => {

        if (!headers.includes(column)) {

            throw new Error(
                `Missing required column: ${column}`
            );

        }

    });

    const columnIndex = {};

    headers.forEach((header, index) => {
        columnIndex[header] = index;
    });

    const dayMap = new Map();

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {

        const row = rows[rowIndex];

        if (row.every(cell => !cell.trim())) {
            continue;
        }

        const lineNumber = rowIndex + 1;

        const getValue = column => {

            const index = columnIndex[column];

            if (index === undefined) {
                return "";
            }

            return (row[index] ?? "").trim();

        };

        const dayName = getValue("day");
        const exerciseName = getValue("exercise");

        const sets = getValue("sets");
        const reps = getValue("reps");

        const rest = getValue("rest");
        const type = getValue("type");
        const notes = getValue("notes");

        if (!dayName || !exerciseName) {

            throw new Error(
                `Row ${lineNumber}: Day and Exercise ` +
                "cannot be empty."
            );

        }

        if (!sets || !reps) {

            throw new Error(
                `Row ${lineNumber}: Sets and Reps ` +
                "cannot be empty."
            );

        }

        const exercise = {

            id: createId(),

            name: exerciseName,

            sets: normalizeRange(
                sets,
                "sets",
                lineNumber
            ),

            reps: normalizeRange(
                reps,
                "reps",
                lineNumber
            ),

            rest: parseRest(
                rest,
                lineNumber
            ),

            type: normalizeType(type),

            notes

        };

        if (!dayMap.has(dayName)) {

            dayMap.set(dayName, {
                id: createId(),
                name: dayName,
                exercises: []
            });

        }

        dayMap.get(dayName).exercises.push(exercise);

    }

    const days = [...dayMap.values()];

    return {

        id: createId(),

        name: "My Training Program",

        createdAt: new Date().toISOString(),

        days

    };

}


/* ==========================================================
   7. VALIDATE PROGRAM
========================================================== */

function validateProgram(program) {

    if (!program.days.length) {

        throw new Error(
            "No valid training days were found."
        );

    }

    program.days.forEach((day, dayIndex) => {

        if (!day.exercises.length) {

            throw new Error(
                `Day ${dayIndex + 1} has no exercises.`
            );

        }

        day.exercises.forEach((exercise, index) => {

            if (!exercise.name.trim()) {

                throw new Error(
                    `Day ${dayIndex + 1}, ` +
                    `exercise ${index + 1} has no name.`
                );

            }

        });

    });

}


/* ==========================================================
   8. CSV PARSER
========================================================== */

/*
   Supports:
   - Comma-separated values
   - Quoted cells
   - Commas inside quoted cells
   - Escaped quotation marks
   - Windows and Unix line endings
   - Multiline quoted cells
*/

function parseCSV(text) {

    const rows = [];

    let row = [];
    let cell = "";
    let insideQuotes = false;

    const input = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < input.length; i++) {

        const char = input[i];
        const next = input[i + 1];

        if (char === '"') {

            if (insideQuotes && next === '"') {

                cell += '"';
                i++;

            } else {

                insideQuotes = !insideQuotes;

            }

            continue;

        }

        if (char === "," && !insideQuotes) {

            row.push(cell);
            cell = "";

            continue;

        }

        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(cell);

            rows.push(row);

            row = [];
            cell = "";

            continue;

        }

        cell += char;

    }

    if (insideQuotes) {

        throw new Error(
            "CSV contains an unclosed quotation mark."
        );

    }

    if (cell !== "" || row.length > 0) {

        row.push(cell);
        rows.push(row);

    }

    return rows.filter(
        row => row.some(cell => cell.trim() !== "")
    );

}


/* ==========================================================
   9. NORMALIZE SETS & REPS
========================================================== */

function normalizeRange(
    value,
    field,
    lineNumber
) {

    const cleaned = String(value)
        .trim()
        .replace(/[–—]/g, "-");

    // Accept values such as:
    // 3
    // 3-4
    // 8-12

    if (!/^\d+(\s*-\s*\d+)?$/.test(cleaned)) {

        throw new Error(
            `Row ${lineNumber}: Invalid ${field} ` +
            `"${value}". Use 3 or 3-4.`
        );

    }

    const numbers = cleaned
        .split("-")
        .map(Number);

    if (numbers.some(number => number < 1)) {

        throw new Error(
            `Row ${lineNumber}: ${field} must be positive.`
        );

    }

    if (
        numbers.length === 2 &&
        numbers[0] > numbers[1]
    ) {

        throw new Error(
            `Row ${lineNumber}: Invalid ${field} range.`
        );

    }

    return cleaned.replace(/\s/g, "");

}


/* ==========================================================
   10. NORMALIZE REST PERIOD
========================================================== */

function parseRest(value, lineNumber) {

    if (!value) {
        return DEFAULT_REST;
    }

    const cleaned = value.trim();

    const seconds = Number(cleaned);

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        throw new Error(
            `Row ${lineNumber}: Rest must be ` +
            "a number of seconds."
        );

    }

    return Math.round(seconds);

}


/* ==========================================================
   11. NORMALIZE EXERCISE TYPE
========================================================== */

function normalizeType(value) {

    const cleaned = String(value ?? "")
        .trim()
        .toLowerCase();

    if (
        cleaned === "time" ||
        cleaned === "timed" ||
        cleaned === "seconds" ||
        cleaned === "duration"
    ) {

        return "time";

    }

    return "reps";

}


/* ==========================================================
   12. TIMED EXERCISE CHECK
========================================================== */

function isTimedExercise(exercise) {

    return exercise.type === "time";

}


/* ==========================================================
   13. IMPORT STATUS
========================================================== */

function showImportStatus(message, type = "info") {

    const container =
        document.getElementById("importStatus");

    if (!container) {
        return;
    }

    container.textContent = message;

    container.style.padding = "13px";
    container.style.borderRadius = "12px";
    container.style.fontSize = "13px";
    container.style.lineHeight = "1.5";

    if (type === "success") {

        container.style.background = "#20351e";
        container.style.border = "1px solid #526e31";
        container.style.color = "#cfff9b";

    } else if (type === "error") {

        container.style.background = "#3b2025";
        container.style.border = "1px solid #8b454e";
        container.style.color = "#ffb3bd";

    } else {

        container.style.background = "#1b2935";
        container.style.border = "1px solid #35556a";
        container.style.color = "#a9dbea";

    }

}


/* ==========================================================
   14. GENERATE UNIQUE IDS
========================================================== */

function createId() {

    if (
        typeof crypto !== "undefined" &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();

    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2)
    );

}