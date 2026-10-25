/* ==========================================================
   VOLT PLANNER
   Version 1.6
========================================================== */

const TYPES = [
    "strength",
    "yoga",
    "bjj",
    "other",
    "sauna"
];

const LABELS = {
    strength: "Weight training",
    yoga: "Yoga",
    bjj: "BJJ",
    other: "Other",
    sauna: "Sauna"
};

let app = null;
let month = null;
let selectedDate = null;
let editId = null;


/* ----------------------------------------------------------
   DATE HELPERS
---------------------------------------------------------- */

function dateKey(date = new Date()) {

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}

function parseDate(key) {

    const [year, month, day] = key.split("-").map(Number);

    return new Date(year, month - 1, day);

}

function workoutDate(workout) {

    const date = new Date(workout.completedAt);

    return Number.isNaN(date.getTime())
        ? null
        : dateKey(date);

}

function dateLabel(key) {

    return parseDate(key).toLocaleDateString(
        undefined,
        {
            weekday: "long",
            month: "long",
            day: "numeric"
        }
    );

}

function mondayOf(date) {

    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    result.setDate(
        result.getDate() - (result.getDay() + 6) % 7
    );

    return result;

}


/* ----------------------------------------------------------
   STORAGE
---------------------------------------------------------- */

function entries() {

    if (!Array.isArray(app.state.plannerEntries)) {
        app.state.plannerEntries = [];
    }

    return app.state.plannerEntries;

}

async function persist() {

    await app.saveData(app.state);

    renderPlanner();

}

function createId() {

    return crypto.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

}


/* ----------------------------------------------------------
   WORKOUT HISTORY INTEGRATION
---------------------------------------------------------- */

function activitiesForDate(key) {

    const manual = entries().filter(
        entry => entry.date === key
    );

    const workouts = (app.state.history ?? []).filter(
        workout => workoutDate(workout) === key
    );

    // Completed strength workouts are read directly from
    // workout history, avoiding duplicate workout records.

    const plannedStrength = manual.filter(
        entry =>
            entry.type === "strength" &&
            entry.status !== "done"
    );

    const completed = workouts.map((workout, index) => ({

        id: `workout:${workout.id}`,

        type: "strength",

        date: key,

        status: "done",

        name: workout.dayName || "Strength workout",

        time: "",

        place: "",

        source: "workout",

        matchedPlanId: plannedStrength[index]?.id ?? null

    }));

    const matchedIds = new Set(
        completed
            .map(item => item.matchedPlanId)
            .filter(Boolean)
    );

    return [
        ...manual.filter(entry => !matchedIds.has(entry.id)),
        ...completed
    ];

}


/* ----------------------------------------------------------
   INITIALIZATION
---------------------------------------------------------- */

export function initPlanner(VOLT) {

    app = VOLT;

    selectedDate = dateKey();

    const today = parseDate(selectedDate);

    month = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    document.getElementById("plannerPrev")
        .addEventListener("click", () => changeMonth(-1));

    document.getElementById("plannerNext")
        .addEventListener("click", () => changeMonth(1));

    document.getElementById("plannerToday")
        .addEventListener("click", () => {

            selectedDate = dateKey();

            const today = parseDate(selectedDate);

            month = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );

            closeEditor();
            renderPlanner();

        });

    document.getElementById("plannerAdd")
        .addEventListener("click", () => openEditor());

    document.getElementById("plannerCancel")
        .addEventListener("click", closeEditor);

    document.getElementById("plannerType")
        .addEventListener("change", updateFields);

    document.getElementById("plannerForm")
        .addEventListener("submit", saveEntry);

    renderPlanner();

}


/* ----------------------------------------------------------
   MONTH NAVIGATION
---------------------------------------------------------- */

function changeMonth(direction) {

    month = new Date(
        month.getFullYear(),
        month.getMonth() + direction,
        1
    );

    selectedDate = dateKey(month);

    closeEditor();

    renderPlanner();

}


/* ----------------------------------------------------------
   CALENDAR
---------------------------------------------------------- */

export function renderPlanner() {

    if (!app?.state) return;

    const grid = document.getElementById(
        "plannerCalendar"
    );

    if (!grid) return;

    document.getElementById("plannerMonth").textContent =
        month.toLocaleDateString(
            undefined,
            {
                month: "long",
                year: "numeric"
            }
        );

    grid.replaceChildren();

    ["M", "T", "W", "T", "F", "S", "S"].forEach(day => {

        const label = document.createElement("span");

        label.className = "planner-weekday";
        label.textContent = day;

        grid.appendChild(label);

    });

    const first = mondayOf(month);

    const last = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0
    );

    const totalDays = Math.round(
        (
            Date.UTC(
                last.getFullYear(),
                last.getMonth(),
                last.getDate()
            ) -
            Date.UTC(
                first.getFullYear(),
                first.getMonth(),
                first.getDate()
            )
        ) / 86400000
    ) + 1;

    const cells = Math.ceil(totalDays / 7) * 7;

    for (let index = 0; index < cells; index++) {

        const date = new Date(
            first.getFullYear(),
            first.getMonth(),
            first.getDate() + index
        );

        const key = dateKey(date);

        const cell = document.createElement("button");

        cell.type = "button";
        cell.className = "planner-day";

        cell.textContent = date.getDate();

        cell.setAttribute("aria-label", dateLabel(key));

        if (date.getMonth() !== month.getMonth()) {
            cell.classList.add("outside");
        }

        if (key === dateKey()) {
            cell.classList.add("today");
        }

        if (key === selectedDate) {
            cell.classList.add("selected");
        }

        const dots = document.createElement("span");

        dots.className = "planner-dots";

        const activities = activitiesForDate(key);

        // One dot per activity category.
        // A completed activity takes priority over planned.

        TYPES.forEach(type => {

            const matching = activities.filter(
                entry => entry.type === type
            );

            if (!matching.length) return;

            const dot = document.createElement("i");

            dot.className = `planner-dot ${type}`;

            if (matching.some(entry => entry.status === "done")) {
                dot.classList.add("solid");
            }

            dots.appendChild(dot);

        });

        cell.appendChild(dots);

        cell.addEventListener("click", () => {

            selectedDate = key;

            if (date.getMonth() !== month.getMonth()) {

                month = new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    1
                );

            }

            closeEditor();
            renderPlanner();

        });

        grid.appendChild(cell);

    }

    renderSelectedDay();
    renderSummaries();

}


/* ----------------------------------------------------------
   SELECTED DAY
---------------------------------------------------------- */

function renderSelectedDay() {

    document.getElementById(
        "plannerSelectedDate"
    ).textContent = dateLabel(selectedDate);

    const container = document.getElementById(
        "plannerDayEntries"
    );

    container.replaceChildren();

    const activities = activitiesForDate(selectedDate)
        .sort((a, b) =>
            (a.time || "").localeCompare(b.time || "")
        );

    if (!activities.length) {

        const empty = document.createElement("p");

        empty.className = "planner-empty";

        empty.textContent = "Nothing planned. A fresh day.";

        container.appendChild(empty);

        return;

    }

    activities.forEach(entry => {

        const row = document.createElement("div");

        row.className = "planner-entry";

        const dot = document.createElement("i");

        dot.className =
            `planner-dot ${entry.type}` +
            (entry.status === "done" ? " solid" : "");

        const details = document.createElement("div");

        details.className = "planner-entry-details";

        const name = document.createElement("strong");

        name.textContent = entry.name || LABELS[entry.type];

        const description = document.createElement("span");

        description.textContent = [
            LABELS[entry.type],
            entry.time,
            entry.place,
            entry.status === "done" ? "Completed" : "Planned"
        ].filter(Boolean).join(" · ");

        details.append(name, description);

        const actions = document.createElement("div");

        actions.className = "planner-entry-actions";

        if (entry.source !== "workout") {

            if (
                entry.status !== "done" &&
                canComplete(entry)
            ) {

                actions.appendChild(
                    makeButton("✓", "planner-action complete", async () => {

                        entry.status = "done";

                        try {
                            await persist();
                        } catch (error) {
                            alert("Could not save: " + error.message);
                        }

                    })
                );

                actions.appendChild(
                    makeButton("✕", "planner-action", async () => {

                        if (!confirm("Remove this missed activity?")) {
                            return;
                        }

                        app.state.plannerEntries = entries().filter(
                            item => item.id !== entry.id
                        );

                        try {
                            await persist();
                        } catch (error) {
                            alert("Could not save: " + error.message);
                        }

                    })
                );

            }

            actions.appendChild(
                makeButton("Edit", "planner-edit", () => {
                    openEditor(entry);
                })
            );

        }

        row.append(dot, details, actions);

        container.appendChild(row);

    });

}

function canComplete(entry) {

    const end = entry.time
        ? new Date(`${entry.date}T${entry.time}:00`)
        : new Date(`${entry.date}T00:00:00`);

    return Date.now() >= end.getTime();

}

function makeButton(label, className, handler) {

    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;

    button.addEventListener("click", handler);

    return button;

}


/* ----------------------------------------------------------
   ADD / EDIT ACTIVITY
---------------------------------------------------------- */

function openEditor(entry = null) {

    editId = entry?.id ?? null;

    document.getElementById("plannerForm").reset();

    document.getElementById("plannerEditor").hidden = false;

    document.getElementById("plannerEditorTitle").textContent =
        entry ? "EDIT ACTIVITY" : "ADD ACTIVITY";

    document.getElementById("plannerType").value =
        entry?.type ?? "strength";

    document.getElementById("plannerEntryName").value =
        entry?.name ?? "";

    document.getElementById("plannerEntryTime").value =
        entry?.time ?? "";

    document.getElementById("plannerEntryPlace").value =
        entry?.place ?? "";

    const deleteButton = document.getElementById(
        "plannerDelete"
    );

    deleteButton.hidden = !entry;

    deleteButton.onclick = async () => {

        if (!confirm("Delete this activity?")) {
            return;
        }

        app.state.plannerEntries = entries().filter(
            item => item.id !== editId
        );

        closeEditor();

        try {
            await persist();
        } catch (error) {
            alert("Could not save: " + error.message);
        }

    };

    updateFields();

    document.getElementById("plannerEditor").scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}

function closeEditor() {

    document.getElementById("plannerEditor").hidden = true;

    editId = null;

}

function updateFields() {

    const type = document.getElementById(
        "plannerType"
    ).value;

    document.getElementById("plannerExtra").hidden =
        type === "strength" || type === "sauna";

    document.getElementById("plannerEntryName").placeholder =
        type === "bjj"
            ? "e.g. Open mat"
            : type === "yoga"
                ? "e.g. Vinyasa flow"
                : "Activity name";

}

async function saveEntry(event) {

    event.preventDefault();

    const type = document.getElementById(
        "plannerType"
    ).value;

    if (!TYPES.includes(type)) return;

    const existing = entries().find(
        entry => entry.id === editId
    );

    const value = {

        id: existing?.id ?? createId(),

        date: selectedDate,

        type,

        status: existing?.status ?? "planned",

        name:
            type === "strength" || type === "sauna"
                ? LABELS[type]
                : document.getElementById(
                    "plannerEntryName"
                ).value.trim(),

        time:
            type === "strength" || type === "sauna"
                ? ""
                : document.getElementById(
                    "plannerEntryTime"
                ).value,

        place:
            type === "strength" || type === "sauna"
                ? ""
                : document.getElementById(
                    "plannerEntryPlace"
                ).value.trim()

    };

    if (existing) {

        Object.assign(existing, value);

    } else {

        entries().push(value);

    }

    closeEditor();

    try {
        await persist();
    } catch (error) {
        alert("Could not save: " + error.message);
    }

}


/* ----------------------------------------------------------
   WEEKLY / MONTHLY SUMMARIES
---------------------------------------------------------- */

function calculateSummary(start, end) {

    const counts = Object.fromEntries(
        TYPES.map(type => [type, 0])
    );

    const completedDays = new Set();

    let planned = 0;
    let completed = 0;

    const cursor = new Date(start);

    while (cursor <= end) {

        const key = dateKey(cursor);

        activitiesForDate(key).forEach(entry => {

            if (entry.status === "done") {

                counts[entry.type]++;

                completed++;

                completedDays.add(key);

            } else {

                planned++;

            }

        });

        cursor.setDate(cursor.getDate() + 1);

    }

    return {
        counts,
        completedDays: completedDays.size,
        planned,
        completed
    };

}

function renderSummary(containerId, summary) {

    const container = document.getElementById(
        containerId
    );

    container.replaceChildren();

    TYPES.forEach(type => {

        const item = document.createElement("div");

        item.className = "planner-summary-item";

        const dot = document.createElement("i");

        dot.className = `planner-dot solid ${type}`;

        const number = document.createElement("strong");

        number.textContent = summary.counts[type];

        const label = document.createElement("span");

        label.textContent = LABELS[type];

        item.append(dot, number, label);

        container.appendChild(item);

    });

    const footer = document.createElement("p");

    footer.className = "planner-summary-footer";

    footer.textContent =
        `${summary.completedDays} active days · ` +
        `${summary.completed} completed · ` +
        `${summary.planned} planned`;

    container.appendChild(footer);

}

function renderSummaries() {

    const selected = parseDate(selectedDate);

    const weekStart = mondayOf(selected);

    const weekEnd = new Date(weekStart);

    weekEnd.setDate(weekEnd.getDate() + 6);

    document.getElementById("plannerWeekLabel").textContent =
        `${weekStart.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        })} – ${weekEnd.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
        })}`;

    renderSummary(
        "plannerWeekSummary",
        calculateSummary(weekStart, weekEnd)
    );

    const monthStart = new Date(
        month.getFullYear(),
        month.getMonth(),
        1
    );

    const monthEnd = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0
    );

    renderSummary(
        "plannerMonthSummary",
        calculateSummary(monthStart, monthEnd)
    );

}