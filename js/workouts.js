/* ==========================================================
   VOLT TRAINING
   workouts.js — Workout Tracking, History & Celebration
   Version 1.3
   ========================================================== */

import {
    saveData
} from "./storage.js";

import {
    startRestTimer,
    stopTimer,
    startExerciseTimer,
    stopExerciseTimer
} from "./timers.js";


/* ==========================================================
   1. MODULE STATE
========================================================== */

let app = null;

let overviewExpanded = false;

let exerciseTimerRunning = false;

let workoutFinishing = false;

let completionAnimationPlayed = false;

let activeSummaryId = null;
let warmupInterval = null;


/* ==========================================================
   2. REGISTER WORKOUT HANDLERS
========================================================== */

export function registerWorkoutHandlers(VOLT) {

    app = VOLT;

    window.completeSet = completeSet;
    window.nextExercise = nextExercise;
    window.finishWorkout = finishWorkout;
    window.skipRest = skipRest;
    window.adjustRest = adjustRest;
    window.toggleOverview = toggleOverview;
    window.cancelWorkout = cancelWorkout;
    window.startTimedSet = startTimedSet;
    window.stopTimedSet = stopTimedSet;

    // Version 1.3 handlers
    window.finishExercise = finishExercise;
    window.addOptionalSet = addOptionalSet;
    window.skipExercise = skipExercise;
    window.finishWorkoutEarly = finishWorkoutEarly;
    window.openWorkoutSummary = openWorkoutSummary;
    window.closeWorkoutSummary = closeWorkoutSummary;
    window.toggleWarmupItem = toggleWarmupItem;
    window.finishWarmup = finishWarmup;
    window.startWarmupTimer = startWarmupTimer;
    window.selectExerciseAlternative = selectExerciseAlternative;
    window.openExerciseGuide = openExerciseGuide;
    window.closeExerciseGuide = closeExerciseGuide;
    window.toggleGuideDetails = toggleGuideDetails;

}


/* ==========================================================
   3. START NEW WORKOUT
========================================================== */

export function startWorkout(VOLT) {

    app = VOLT;

    const state = app.state;

    if (state.activeWorkout) {

        resumeWorkout(VOLT);

        return;

    }

    const program = state.program;

    if (!program?.days?.length) {
        return;
    }

    const dayIndex = state.currentDayIndex ?? 0;

    const day = program.days[dayIndex];

    if (!day?.exercises?.length) {
        return;
    }

    stopTimer();
    stopExerciseTimer();

    exerciseTimerRunning = false;
    workoutFinishing = false;
    completionAnimationPlayed = false;
    activeSummaryId = null;

    const now = new Date().toISOString();

    state.activeWorkout = {

        id: createId(),

        programId: program.id ?? null,

        programName: program.name,

        dayIndex,

        dayName: day.name,

        cycle: state.currentCycle ?? 1,

        startedAt: now,

        exerciseIndex: 0,

        setIndex: 0,

        phase: Array.isArray(day.warmup) && day.warmup.length ? "warmup" : "exercise",

        warmup: (day.warmup ?? []).map(item => ({...structuredClone(item), done: false})),

        restEndsAt: null,

        exercises: day.exercises.map(exercise => {

            const range = parseSetRange(exercise.sets);

            return {

                ...structuredClone(exercise),

                selectedAlternative: exercise.alternatives?.[0] ?? null,
                name: exercise.alternatives?.[0] ?? exercise.name,

                minSets: range.min,

                maxSets: range.max,

                prescribedSets: range.min,

                completed: false,

                skipped: false,

                loggedSets: []

            };

        })

    };

    overviewExpanded = false;

    saveWorkoutState();

    renderWorkout(VOLT);

}


/* ==========================================================
   4. RESUME WORKOUT
========================================================== */

export function resumeWorkout(VOLT) {

    app = VOLT;

    if (!app.state.activeWorkout) {
        return;
    }

    renderWorkout(VOLT);

}


/* ==========================================================
   5. RENDER WORKOUT
========================================================== */

export function renderWorkout(VOLT) {

    app = VOLT;

    const root = document.getElementById(
        "focusRoot"
    );

    if (!root) {
        return;
    }

    const workout = app.state.activeWorkout;

    if (!workout) {

        root.innerHTML = `
            <div class="card empty">
                <h2>No active workout</h2>

                <p>
                    Start your next workout from the Home screen.
                </p>

                <button
                    class="primary"
                    onclick="showTab('home')"
                >
                    GO HOME
                </button>
            </div>
        `;

        return;

    }

    if (workout.phase === "warmup") {
        renderWarmup(root, workout);
        return;
    }

    // Upgrade an unfinished Version 1.2 workout
    // without discarding any logged sets.
    normalizeActiveWorkout(workout);

    const exercise =
        workout.exercises[workout.exerciseIndex];

    if (!exercise) {

        renderWorkoutCompletion(root, workout);

        return;

    }

    if (workout.phase === "rest") {

        // Recover gracefully when a rest period
        // expired while the app was closed.
        if (
            !Number.isFinite(workout.restEndsAt) ||
            workout.restEndsAt <= Date.now()
        ) {

            stopTimer();

            workout.phase = "exercise";
            workout.restEndsAt = null;

            saveWorkoutState();

        } else {

            renderRestScreen(
                root,
                workout,
                exercise
            );

            return;

        }

    }

    if (workout.phase === "exerciseDone") {

        renderExerciseCompletion(
            root,
            workout,
            exercise
        );

        return;

    }

    if (workout.phase === "optionalSet") {

        renderOptionalSetDecision(
            root,
            workout,
            exercise
        );

        return;

    }

    renderFocusedExercise(
        root,
        workout,
        exercise
    );

}


/* ==========================================================
   5A. WARM-UP FLOW — OFFLINE, PERSISTENT CHECKLIST
========================================================== */
function renderWarmup(root, workout) {
    const items = workout.warmup ?? [];
    const done = items.filter(item => item.done).length;
    root.innerHTML = `
        <div class="focus-header"><div><div class="eyebrow">${escapeHTML(workout.dayName)}</div>
        <div class="small muted">PREPARE TO TRAIN · ${done}/${items.length} complete</div></div>
        <button class="secondary" onclick="cancelWorkout()">EXIT</button></div>
        <section class="focus-card volt-warmup-card">
            <div class="eyebrow">YOUR WARM-UP</div><h2>Get ready to move</h2>
            <p class="small muted">Short, controlled preparation. Check off each movement as you go.</p>
            <div class="volt-warmup-progress"><div style="width:${items.length ? 100*done/items.length : 0}%"></div></div>
            ${items.map((item, index) => `
                <div class="volt-warmup-row ${item.done ? 'is-done' : ''}">
                    <button class="volt-warmup-check" onclick="toggleWarmupItem(${index})" aria-label="Mark ${escapeHTML(item.name)} complete">${item.done ? '✓' : '○'}</button>
                    <div class="volt-warmup-info">
                        <strong>${escapeHTML(item.name)}</strong>
                        <span>${escapeHTML(String(item.sets))} × ${escapeHTML(String(item.reps))} ${item.type === 'time' ? 'sec' : 'reps'}${item.perSide ? ' / side' : ''}</span>
                        ${item.notes ? `<small>${escapeHTML(item.notes)}</small>` : ''}
                    </div>
                    ${item.type === 'time' ? `<button class="volt-warmup-timer-btn" onclick="startWarmupTimer(${index})">⏱</button>` : ''}
                </div>`).join('')}
            <div id="voltWarmupTimer" class="volt-warmup-timer" aria-live="polite"></div>
            <button class="primary volt-warmup-finish" onclick="finishWarmup()">${done === items.length ? '✓ COMPLETE WARM-UP' : 'CONTINUE TO WORKOUT →'}</button>
            <button class="secondary volt-warmup-skip" onclick="finishWarmup()">SKIP REMAINING WARM-UP</button>
        </section>`;
}

export function toggleWarmupItem(index) {
    const workout = app?.state?.activeWorkout;
    if (!workout || workout.phase !== 'warmup' || !workout.warmup[index]) return;
    workout.warmup[index].done = !workout.warmup[index].done;
    saveWorkoutState();
    renderWorkout(app);
}

export function finishWarmup() {
    const workout = app?.state?.activeWorkout;
    if (!workout || workout.phase !== 'warmup') return;
    clearInterval(warmupInterval);
    warmupInterval = null;
    workout.phase = 'exercise';
    saveWorkoutState();
    renderWorkout(app);
}

export function startWarmupTimer(index) {
    const workout = app?.state?.activeWorkout;
    const item = workout?.warmup?.[index];
    if (!item || item.type !== 'time') return;
    clearInterval(warmupInterval);
    const seconds = Number(String(item.reps).split('-')[0]);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    const display = document.getElementById('voltWarmupTimer');
    const tick = () => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (display) display.textContent = `⏱ ${escapeHTML(item.name)}: ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
        if (left === 0) {
            clearInterval(warmupInterval);
            warmupInterval = null;
            if (display) display.textContent = '✓ Timer complete — mark the movement done.';
        }
    };
    tick();
    warmupInterval = setInterval(tick, 250);
}

export function selectExerciseAlternative(name) {
    const workout = app?.state?.activeWorkout;
    const exercise = workout?.exercises?.[workout.exerciseIndex];
    if (!exercise?.alternatives?.includes(name)) return;
    if (exercise.loggedSets?.length) {
        alert('Finish this exercise before switching movements. Logged sets must stay associated with the correct exercise.');
        renderWorkout(app);
        return;
    }
    exercise.selectedAlternative = name;
    exercise.name = name;
    saveWorkoutState();
    renderWorkout(app);
}

export function openExerciseGuide() {
    const workout = app?.state?.activeWorkout;
    const exercise = workout?.exercises?.[workout.exerciseIndex];
    if (!exercise) return;
    closeExerciseGuide();
    const modal = document.createElement('div');
    modal.className = 'volt-guide-backdrop';
    modal.id = 'voltGuideModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Exercise instructions');
    modal.addEventListener('click', event => { if (event.target === modal) closeExerciseGuide(); });
    const notes = exercise.notes || 'Move with control, use a comfortable range of motion, and keep your technique consistent.';
    modal.innerHTML = `<div class="volt-guide-panel">
        <button class="volt-guide-close" onclick="closeExerciseGuide()" aria-label="Close">×</button>
        <div class="eyebrow">EXERCISE GUIDE</div>
        <h2>${escapeHTML(exercise.name)}</h2>
        <p class="volt-guide-cues">${escapeHTML(notes)}</p>
        <button class="secondary" onclick="toggleGuideDetails()">+ SHOW TRAINING DETAILS</button>
        <div id="voltGuideDetails" hidden>
            <p><strong>Prescription:</strong> ${escapeHTML(String(exercise.sets))} sets × ${escapeHTML(String(exercise.reps))} ${exercise.type === 'time' ? 'seconds' : exercise.type === 'distance' ? 'metres' : 'reps'}${exercise.perSide ? ' per side' : ''}.</p>
            <p><strong>Rest:</strong> ${escapeHTML(String(exercise.rest ?? 90))} seconds.</p>
            <p><strong>Training principle:</strong> Prioritise controlled movement and consistent technique. Stop short of grinding repetitions.</p>
        </div>
    </div>`;
    document.body.appendChild(modal);
    document.addEventListener('keydown', guideEscapeHandler);
}
function guideEscapeHandler(event) { if (event.key === 'Escape') closeExerciseGuide(); }
export function closeExerciseGuide() {
    document.getElementById('voltGuideModal')?.remove();
    document.removeEventListener('keydown', guideEscapeHandler);
}
export function toggleGuideDetails() {
    const details = document.getElementById('voltGuideDetails');
    if (details) details.hidden = !details.hidden;
}

/* ==========================================================
   6. FOCUSED EXERCISE INTERFACE
========================================================== */

function renderFocusedExercise(
    root,
    workout,
    exercise
) {

    const exerciseNumber =
        workout.exerciseIndex + 1;

    const totalExercises =
        workout.exercises.length;

    const setNumber =
        workout.setIndex + 1;

    const minSets = exercise.minSets;
    const maxSets = exercise.maxSets;

    const isTimed = isTimedExercise(exercise);

    const previous = getPreviousPerformance(
        exercise.name
    );

    const suggestedWeight =
        getSuggestedWeightForSet(exercise);

    const suggestedReps =
        getSuggestedRepsForSet(exercise);

    const targetReps =
        exercise.reps ?? "";

    const completedSets =
        exercise.loggedSets.length;

    const setTarget = formatSetRange(exercise);

    root.innerHTML = `
        <div class="focus-header">

            <div>
                <div class="eyebrow">
                    ${escapeHTML(workout.dayName)}
                </div>

                <div class="small muted">
                    Cycle ${workout.cycle}
                    · Exercise ${exerciseNumber}
                    of ${totalExercises}
                </div>
            </div>

            <button
                class="secondary"
                onclick="cancelWorkout()"
            >
                EXIT
            </button>

        </div>


        <div class="focus-card">

            <div class="eyebrow">
                CURRENT EXERCISE
            </div>

            <div class="volt-exercise-heading">
                <h2>${escapeHTML(exercise.name)}</h2>
                <button class="volt-info-button" onclick="openExerciseGuide()" aria-label="Exercise instructions">ⓘ</button>
            </div>
            ${Array.isArray(exercise.alternatives) && exercise.alternatives.length ? `
                <label class="volt-alternative-label">EXERCISE OPTION
                    <select class="volt-alternative-select" onchange="selectExerciseAlternative(this.value)">
                        ${exercise.alternatives.map(option => `<option value="${escapeHTML(option)}" ${option === (exercise.selectedAlternative || exercise.alternatives[0]) ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}
                    </select>
                </label>
            ` : ''}

            <div class="small muted">
                ${setTarget} sets
                · Target:
                ${escapeHTML(String(targetReps))}
                ${isTimed ? "seconds" : "reps"}
            </div>


            <div class="focus-progress">
                ${renderSetProgress(
                    maxSets,
                    completedSets,
                    minSets
                )}
            </div>


            <div class="set-indicator">
                SET ${setNumber}
                ${setNumber > minSets
                    ? "· OPTIONAL SET"
                    : `OF ${minSets} MINIMUM`
                }
            </div>


            ${previous ? `
                <div class="focus-previous">
                    <strong>LAST TIME</strong><br>
                    ${escapeHTML(previous)}
                </div>
            ` : ""}


            ${
                isTimed
                    ? renderTimedInputs(
                        exercise,
                        suggestedWeight
                    )
                    : renderRepetitionInputs(
                        suggestedWeight,
                        suggestedReps
                    )
            }


            <div class="focus-actions">

                ${
                    isTimed
                        ? `
                            <button
                                class="primary"
                                id="timedStartBtn"
                                onclick="startTimedSet()"
                            >
                                ▶ START TIMER
                            </button>

                            <button
                                class="secondary full-width"
                                id="timedStopBtn"
                                onclick="stopTimedSet()"
                                disabled
                            >
                                STOP & LOG SET
                            </button>
                        `
                        : `
                            <button
                                class="primary"
                                onclick="completeSet()"
                            >
                                ✓ COMPLETE SET
                            </button>
                        `
                }

            </div>

            <div class="volt-secondary-actions">

                <button
                    class="secondary"
                    onclick="skipExercise()"
                >
                    SKIP EXERCISE
                </button>

                <button
                    class="secondary"
                    onclick="finishWorkoutEarly()"
                >
                    FINISH WORKOUT
                </button>

            </div>

        </div>


        ${renderOverview(workout)}
    `;

}


/* ==========================================================
   7. REPETITION EXERCISE INPUTS
========================================================== */

function renderRepetitionInputs(
    suggestedWeight,
    suggestedReps
) {

    return `
        <div class="focus-fields">

            <label>
                WEIGHT (KG)

                <input
                    id="setWeight"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.5"
                    value="${escapeHTML(
                        String(suggestedWeight)
                    )}"
                    placeholder="0"
                >
            </label>

            <label>
                REPS

                <input
                    id="setReps"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    step="1"
                    value="${escapeHTML(
                        String(suggestedReps)
                    )}"
                    placeholder="0"
                >
            </label>

        </div>
    `;

}


/* ==========================================================
   8. TIMED EXERCISE INPUTS
========================================================== */

function renderTimedInputs(
    exercise,
    suggestedWeight
) {

    const previousSet =
        exercise.loggedSets.at(-1);

    const target = previousSet?.seconds ??
        parseRepTarget(exercise.reps);

    return `
        <div class="timed-exercise">

            <div class="set-target">
                TARGET:
                ${escapeHTML(String(exercise.reps))}
                SECONDS
            </div>

            <div
                class="timer-display"
                id="exerciseTimerDisplay"
            >
                00:00
            </div>

            <div class="focus-fields">

                <label>
                    WEIGHT (KG)

                    <input
                        id="setWeight"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="0.5"
                        value="${escapeHTML(
                            String(suggestedWeight)
                        )}"
                    >
                </label>

                <label>
                    SECONDS

                    <input
                        id="setSeconds"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        value="${escapeHTML(
                            String(target)
                        )}"
                    >
                </label>

            </div>

        </div>
    `;

}


/* ==========================================================
   9. COMPLETE A SET
========================================================== */

export function completeSet() {

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "exercise"
    ) {
        return;
    }

    const exercise =
        workout.exercises[workout.exerciseIndex];

    if (!exercise) {
        return;
    }

    const isTimed = isTimedExercise(exercise);

    const weight = readNumber("setWeight");

    const performance = isTimed
        ? readNumber("setSeconds")
        : readNumber("setReps");

    if (
        !Number.isFinite(weight) ||
        !Number.isFinite(performance) ||
        weight < 0 ||
        performance <= 0 ||
        (!isTimed && !Number.isInteger(performance))
    ) {

        alert(
            "Please enter a valid weight and " +
            (isTimed ? "duration." : "number of reps.")
        );

        return;

    }

    // Protect against duplicate logging.
    if (
        exercise.loggedSets.length >=
        exercise.maxSets
    ) {
        return;
    }

    const loggedSet = {

        set: exercise.loggedSets.length + 1,

        weight,

        reps: isTimed ? null : performance,

        seconds: isTimed ? performance : null,

        completedAt: new Date().toISOString()

    };

    exercise.loggedSets.push(loggedSet);

    workout.setIndex =
        exercise.loggedSets.length;

    stopExerciseTimer();
    exerciseTimerRunning = false;

    // Maximum sets reached.
    if (
        exercise.loggedSets.length >=
        exercise.maxSets
    ) {

        exercise.completed = true;

        workout.phase = "exerciseDone";

        saveWorkoutState();

        renderWorkout(app);

        return;

    }

    // Minimum sets reached.
    // Ask whether to finish or add another set.
    if (
        exercise.loggedSets.length >=
        exercise.minSets
    ) {

        workout.phase = "optionalSet";

        saveWorkoutState();

        renderWorkout(app);

        return;

    }

    // More required sets remain.
    startRestBetweenSets(workout, exercise);

}


/* ==========================================================
   10. START REST BETWEEN SETS
========================================================== */

function startRestBetweenSets(
    workout,
    exercise
) {

    const restSeconds =
        parseRestSeconds(exercise.rest);

    if (restSeconds > 0) {

        workout.phase = "rest";

        workout.restEndsAt =
            Date.now() + restSeconds * 1000;

        saveWorkoutState();

        renderWorkout(app);

    } else {

        workout.phase = "exercise";

        workout.restEndsAt = null;

        saveWorkoutState();

        renderWorkout(app);

    }

}


/* ==========================================================
   11. REST TIMER SCREEN
========================================================== */

function renderRestScreen(
    root,
    workout,
    exercise
) {

    const remainingSeconds = Math.max(
        0,
        Math.ceil(
            (
                workout.restEndsAt - Date.now()
            ) / 1000
        )
    );

    root.innerHTML = `
        <div class="focus-header">

            <div class="eyebrow">
                ${escapeHTML(workout.dayName)}
            </div>

            <button
                class="secondary"
                onclick="cancelWorkout()"
            >
                EXIT
            </button>

        </div>

        <div class="focus-card">

            <div class="rest-panel">

                <div class="eyebrow">
                    RECOVER & RESET
                </div>

                <h2>Rest Time</h2>

                <div
                    class="rest-clock"
                    id="restClock"
                >
                    ${formatTime(remainingSeconds)}
                </div>

                <p>
                    Next:
                    Set ${workout.setIndex + 1}
                    of ${exercise.maxSets}
                </p>

                <div class="rest-adjust">

                    <button
                        class="secondary"
                        onclick="adjustRest(-15)"
                    >
                        −15 SEC
                    </button>

                    <button
                        class="secondary"
                        onclick="adjustRest(15)"
                    >
                        +15 SEC
                    </button>

                </div>

                <button
                    class="primary"
                    onclick="skipRest()"
                >
                    SKIP REST
                </button>

                <div class="volt-secondary-actions">

                    <button
                        class="secondary"
                        onclick="skipExercise()"
                    >
                        SKIP EXERCISE
                    </button>

                    <button
                        class="secondary"
                        onclick="finishWorkoutEarly()"
                    >
                        FINISH WORKOUT
                    </button>

                </div>

            </div>

        </div>

        ${renderOverview(workout)}
    `;

    startRestTimer(
        workout.restEndsAt,
        () => finishRest()
    );

}


/* ==========================================================
   12. REST TIMER ACTIONS
========================================================== */

export function skipRest() {

    stopTimer();

    finishRest();

}


export function adjustRest(seconds) {

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "rest"
    ) {
        return;
    }

    workout.restEndsAt = Math.max(
        Date.now(),
        workout.restEndsAt + seconds * 1000
    );

    saveWorkoutState();

    renderWorkout(app);

}


function finishRest() {

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "rest"
    ) {
        return;
    }

    stopTimer();

    workout.phase = "exercise";

    workout.restEndsAt = null;

    saveWorkoutState();

    renderWorkout(app);

}


/* ==========================================================
   13. OPTIONAL SET DECISION
========================================================== */

function renderOptionalSetDecision(
    root,
    workout,
    exercise
) {

    const completedSets =
        exercise.loggedSets.length;

    const nextSet =
        completedSets + 1;

    root.innerHTML = `
        <div class="focus-card">

            <div class="focus-done">

                <div class="eyebrow">
                    MINIMUM TARGET REACHED
                </div>

                <div class="big volt-success-icon">
                    ✓
                </div>

                <h2>
                    ${escapeHTML(exercise.name)}
                </h2>

                <p>
                    ${completedSets}
                    sets completed.
                </p>

                <p class="muted">
                    You've reached your minimum
                    set target.
                </p>

                <div class="volt-decision-actions">

                    <button
                        class="primary"
                        onclick="finishExercise()"
                    >
                        FINISH EXERCISE →
                    </button>

                    <button
                        class="secondary"
                        onclick="addOptionalSet()"
                    >
                        + ADD SET ${nextSet}
                    </button>

                </div>

            </div>

        </div>

        ${renderOverview(workout)}
    `;

}


/* ==========================================================
   14. ADD OPTIONAL SET
========================================================== */

export function addOptionalSet() {

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "optionalSet"
    ) {
        return;
    }

    const exercise =
        workout.exercises[workout.exerciseIndex];

    if (!exercise) {
        return;
    }

    if (
        exercise.loggedSets.length >=
        exercise.maxSets
    ) {
        return;
    }

    startRestBetweenSets(
        workout,
        exercise
    );

}


/* ==========================================================
   15. FINISH CURRENT EXERCISE
========================================================== */

export function finishExercise() {

    const workout =
        app?.state?.activeWorkout;

    if (!workout) {
        return;
    }

    const exercise =
        workout.exercises[workout.exerciseIndex];

    if (!exercise) {
        return;
    }

    if (
        exercise.loggedSets.length <
        exercise.minSets
    ) {
        return;
    }

    stopTimer();
    stopExerciseTimer();

    exerciseTimerRunning = false;

    exercise.completed = true;

    workout.phase = "exerciseDone";
    workout.restEndsAt = null;

    saveWorkoutState();

    renderWorkout(app);

}


/* ==========================================================
   16. EXERCISE COMPLETION
========================================================== */

function renderExerciseCompletion(
    root,
    workout,
    exercise
) {

    const isLastExercise =
        workout.exerciseIndex >=
        workout.exercises.length - 1;

    root.innerHTML = `
        <div class="focus-card">

            <div class="focus-done">

                <div class="eyebrow">
                    EXERCISE COMPLETE
                </div>

                <div class="big volt-success-icon">
                    ✓
                </div>

                <h2>
                    ${escapeHTML(exercise.name)}
                </h2>

                <p>
                    ${exercise.loggedSets.length}
                    sets completed.
                </p>

                <button
                    class="primary"
                    onclick="${
                        isLastExercise
                            ? "finishWorkout()"
                            : "nextExercise()"
                    }"
                >
                    ${
                        isLastExercise
                            ? "FINISH WORKOUT"
                            : "NEXT EXERCISE →"
                    }
                </button>

                ${
                    !isLastExercise
                        ? `
                            <button
                                class="secondary"
                                onclick="finishWorkoutEarly()"
                            >
                                FINISH WORKOUT NOW
                            </button>
                        `
                        : ""
                }

            </div>

        </div>

        ${renderOverview(workout)}
    `;

}


/* ==========================================================
   17. NEXT EXERCISE
========================================================== */

export function nextExercise() {

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "exerciseDone"
    ) {
        return;
    }

    if (
        workout.exerciseIndex >=
        workout.exercises.length - 1
    ) {

        finishWorkout();

        return;

    }

    workout.exerciseIndex++;

    workout.setIndex = 0;

    workout.phase = "exercise";

    workout.restEndsAt = null;

    saveWorkoutState();

    renderWorkout(app);

}


/* ==========================================================
   18. SKIP EXERCISE
========================================================== */

export function skipExercise() {

    const workout =
        app?.state?.activeWorkout;

    if (!workout) {
        return;
    }

    const exercise =
        workout.exercises[workout.exerciseIndex];

    if (!exercise) {
        return;
    }

    const hasLoggedSets =
        exercise.loggedSets.length > 0;

    const message = hasLoggedSets
        ? "Move to the next exercise? Your logged sets will be kept."
        : "Skip this exercise and move to the next one?";

    if (!confirm(message)) {
        return;
    }

    stopTimer();
    stopExerciseTimer();

    exerciseTimerRunning = false;

    exercise.skipped = true;

    // Preserve partially completed exercises.
    exercise.completed =
        exercise.loggedSets.length >=
        exercise.minSets;

    workout.restEndsAt = null;

    if (
        workout.exerciseIndex >=
        workout.exercises.length - 1
    ) {

        finishWorkoutEarly();

        return;

    }

    workout.exerciseIndex++;

    workout.setIndex = 0;

    workout.phase = "exercise";

    saveWorkoutState();

    renderWorkout(app);

}


/* ==========================================================
   19. FINISH WORKOUT EARLY
========================================================== */

export function finishWorkoutEarly() {

    const workout =
        app?.state?.activeWorkout;

    if (!workout) {
        return;
    }

    const totalSets =
        getTotalSets(workout);

    if (totalSets === 0) {

        alert(
            "Log at least one set before finishing. " +
            "You can also exit and resume later."
        );

        return;

    }

    const remaining =
        workout.exercises.filter(
            exercise => !exercise.completed
        ).length;

    if (remaining > 0) {

        const proceed = confirm(
            `Finish your workout now?\n\n` +
            `${remaining} exercise(s) have not been fully completed.\n\n` +
            `All logged sets will be saved.`
        );

        if (!proceed) {
            return;
        }

    }

    finishWorkout(true);

}


/* ==========================================================
   20. WORKOUT COMPLETION FALLBACK
========================================================== */

function renderWorkoutCompletion(
    root,
    workout
) {

    root.innerHTML = `
        <div class="focus-card">

            <div class="focus-done">

                <div class="big volt-success-icon">
                    ✓
                </div>

                <h2>
                    Workout Complete
                </h2>

                <p>
                    ${escapeHTML(workout.dayName)}
                </p>

                <button
                    class="primary"
                    onclick="finishWorkout()"
                >
                    SAVE WORKOUT
                </button>

            </div>

        </div>
    `;

}


/* ==========================================================
   21. FINISH WORKOUT & ADVANCE ROTATION
========================================================== */

export function finishWorkout(allowPartial = false) {

    if (workoutFinishing) {
        return;
    }

    const state = app?.state;

    const workout = state?.activeWorkout;

    if (!workout) {
        return;
    }

    const allCompleted =
        workout.exercises.every(
            exercise =>
                exercise.completed ||
                exercise.skipped
        );

    if (
        !allowPartial &&
        !allCompleted
    ) {

        alert(
            "Complete all exercises or use " +
            "'Finish Workout' to save a partial session."
        );

        return;

    }

    if (getTotalSets(workout) === 0) {

        alert(
            "You must log at least one set " +
            "before saving a workout."
        );

        return;

    }

    workoutFinishing = true;

    stopTimer();
    stopExerciseTimer();

    exerciseTimerRunning = false;

    const completedAt =
        new Date().toISOString();

    const completedWorkout = {

        ...structuredClone(workout),

        completedAt,

        durationSeconds: Math.max(
            0,
            Math.round(
                (
                    Date.now() -
                    new Date(workout.startedAt).getTime()
                ) / 1000
            )
        ),

        partial: !allCompleted

    };

    if (!Array.isArray(state.history)) {
        state.history = [];
    }

    // Additional protection against duplicate history entries.
    const alreadySaved =
        state.history.some(
            item => item.id === completedWorkout.id
        );

    if (alreadySaved) {

        state.activeWorkout = null;

        workoutFinishing = false;

        saveWorkoutState();

        return;

    }

    state.history.push(completedWorkout);

    state.activeWorkout = null;

    const totalDays =
        state.program.days.length;

    const currentIndex =
        state.currentDayIndex ?? 0;

    const nextIndex =
        (currentIndex + 1) % totalDays;

    state.currentDayIndex = nextIndex;

    if (nextIndex === 0) {

        state.completedCycles =
            (state.completedCycles ?? 0) + 1;

        state.currentCycle =
            (state.currentCycle ?? 1) + 1;

    }

    saveWorkoutState();

    workoutFinishing = false;

    completionAnimationPlayed = false;

    activeSummaryId = completedWorkout.id;

    // Refresh dashboard and history.
    if (typeof app.refreshApp === "function") {

        app.refreshApp();

    }

    // Display celebration in the workout tab.
    if (typeof window.showTab === "function") {

        window.showTab("workout");

    }

    renderCompletedWorkout(
        completedWorkout,
        true
    );

}


/* ==========================================================
   22. WORKOUT CELEBRATION & SUMMARY
========================================================== */

function renderCompletedWorkout(
    workout,
    celebrate = false
) {

    const root =
        document.getElementById("focusRoot");

    if (!root) {
        return;
    }

    stopTimer();

    const summary =
        calculateWorkoutSummary(workout);

    const nextDay =
        app?.state?.program?.days?.[
            app.state.currentDayIndex ?? 0
        ];

    root.innerHTML = `
        <div class="volt-completion-screen">

            <div class="volt-celebration-header">

                <div class="volt-celebration-bolt">
                    ⚡
                </div>

                <div class="eyebrow">
                    SESSION COMPLETE
                </div>

                <h1>
                    CRUSHED IT.
                </h1>

                <p class="muted">
                    ${escapeHTML(workout.dayName)}
                </p>

                <div class="volt-completion-date">
                    ${escapeHTML(
                        new Date(
                            workout.completedAt
                        ).toLocaleDateString(
                            undefined,
                            {
                                weekday: "long",
                                month: "long",
                                day: "numeric"
                            }
                        )
                    )}
                </div>

            </div>


            <div class="volt-summary-grid">

                ${renderSummaryMetric(
                    "DURATION",
                    formatDuration(
                        summary.durationSeconds
                    )
                )}

                ${renderSummaryMetric(
                    "TOTAL VOLUME",
                    `${Math.round(
                        summary.volume
                    ).toLocaleString()} kg`
                )}

                ${renderSummaryMetric(
                    "TOTAL SETS",
                    summary.totalSets
                )}

                ${renderSummaryMetric(
                    "EXERCISES",
                    `${summary.exercisesPerformed}/${summary.totalExercises}`
                )}

            </div>


            <div class="volt-summary-section">

                <div class="eyebrow">
                    YOUR PERFORMANCE
                </div>

                ${renderPerformanceBreakdown(workout)}

            </div>


            ${
                workout.partial
                    ? `
                        <div class="volt-partial-note">
                            Shortened session ·
                            All completed sets were saved.
                        </div>
                    `
                    : ""
            }


            ${
                nextDay && celebrate
                    ? `
                        <div class="volt-next-workout">

                            <div class="eyebrow">
                                NEXT UP
                            </div>

                            <h3>
                                ${escapeHTML(nextDay.name)}
                            </h3>

                        </div>
                    `
                    : ""
            }


            <button
                class="primary volt-home-button"
                onclick="closeWorkoutSummary()"
            >
                BACK TO HOME
            </button>

        </div>
    `;

    if (
        celebrate &&
        !completionAnimationPlayed
    ) {

        completionAnimationPlayed = true;

        playCompletionAnimation(root);

    }

}


/* ==========================================================
   23. SUMMARY METRIC CARD
========================================================== */

function renderSummaryMetric(label, value) {

    return `
        <div class="volt-summary-metric">

            <div class="eyebrow">
                ${escapeHTML(label)}
            </div>

            <div class="volt-summary-value">
                ${escapeHTML(String(value))}
            </div>

        </div>
    `;

}


/* ==========================================================
   24. PERFORMANCE BREAKDOWN
========================================================== */

function renderPerformanceBreakdown(workout) {

    const performedExercises =
        workout.exercises.filter(
            exercise =>
                exercise.loggedSets?.length > 0
        );

    if (!performedExercises.length) {

        return `
            <p class="muted">
                No sets were recorded.
            </p>
        `;

    }

    return performedExercises.map(
        exercise => {

            const sets = exercise.loggedSets.map(
                set => {

                    const performance =
                        set.seconds != null
                            ? `${set.seconds} sec`
                            : `${set.weight} kg × ${set.reps}`;

                    const weightDetail =
                        set.seconds != null &&
                        set.weight > 0
                            ? ` · ${set.weight} kg`
                            : "";

                    return `
                        <div class="volt-performance-set">

                            <span>
                                Set ${set.set}
                            </span>

                            <strong>
                                ${escapeHTML(
                                    performance + weightDetail
                                )}
                            </strong>

                        </div>
                    `;

                }
            ).join("");

            return `
                <div class="volt-performance-exercise">

                    <h3>
                        ${escapeHTML(exercise.name)}
                    </h3>

                    ${sets}

                </div>
            `;

        }
    ).join("");

}


/* ==========================================================
   25. CALCULATE WORKOUT SUMMARY
========================================================== */

function calculateWorkoutSummary(workout) {

    let totalSets = 0;

    let volume = 0;

    let exercisesPerformed = 0;

    workout.exercises.forEach(exercise => {

        const sets =
            exercise.loggedSets ?? [];

        if (sets.length > 0) {
            exercisesPerformed++;
        }

        totalSets += sets.length;

        sets.forEach(set => {

            if (
                set.reps != null &&
                Number.isFinite(Number(set.weight)) &&
                Number.isFinite(Number(set.reps))
            ) {

                volume +=
                    Number(set.weight) *
                    Number(set.reps);

            }

        });

    });

    return {

        durationSeconds:
            workout.durationSeconds ?? 0,

        totalSets,

        volume,

        exercisesPerformed,

        totalExercises:
            workout.exercises.length

    };

}


/* ==========================================================
   26. CELEBRATION ANIMATION
========================================================== */

function playCompletionAnimation(root) {

    const header = root.querySelector(
        ".volt-celebration-header"
    );

    if (!header) {
        return;
    }

    header.classList.add(
        "volt-celebrate"
    );

    // Respect reduced-motion preferences.
    if (
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
    ) {
        return;
    }

    const colors = [
        "#baff4c",
        "#53e6ee",
        "#ffffff"
    ];

    const container =
        document.createElement("div");

    container.className =
        "volt-confetti-container";

    for (let index = 0; index < 35; index++) {

        const piece =
            document.createElement("span");

        piece.className =
            "volt-confetti-piece";

        piece.style.left =
            `${Math.random() * 100}%`;

        piece.style.backgroundColor =
            colors[index % colors.length];

        piece.style.animationDelay =
            `${Math.random() * 0.6}s`;

        piece.style.animationDuration =
            `${1.5 + Math.random()}s`;

        container.appendChild(piece);

    }

    header.appendChild(container);

    setTimeout(() => {

        container.remove();

    }, 3200);

}


/* ==========================================================
   27. OPEN SAVED WORKOUT SUMMARY
========================================================== */

export function openWorkoutSummary(workoutId) {

    const history =
        app?.state?.history ?? [];

    const workout = history.find(
        item => item.id === workoutId
    );

    if (!workout) {
        return;
    }

    activeSummaryId = workoutId;

    completionAnimationPlayed = true;

    if (typeof window.showTab === "function") {

        window.showTab("workout");

    }

    renderCompletedWorkout(
        workout,
        false
    );

}


/* ==========================================================
   28. CLOSE WORKOUT SUMMARY
========================================================== */

export function closeWorkoutSummary() {

    activeSummaryId = null;

    completionAnimationPlayed = false;

    if (typeof window.showTab === "function") {

        window.showTab("home");

    }

}


/* ==========================================================
   29. EXIT WORKOUT
========================================================== */

export function cancelWorkout() {

    clearInterval(warmupInterval);
    warmupInterval = null;
    closeExerciseGuide();

    stopTimer();
    stopExerciseTimer();

    exerciseTimerRunning = false;

    saveWorkoutState();

    if (typeof window.showTab === "function") {

        window.showTab("home");

    }

}


/* ==========================================================
   30. COLLAPSIBLE WORKOUT OVERVIEW
========================================================== */

export function toggleOverview() {

    overviewExpanded = !overviewExpanded;

    renderWorkout(app);

}


function renderOverview(workout) {

    return `
        <div class="focus-overview">

            <button
                onclick="toggleOverview()"
            >
                ${
                    overviewExpanded
                        ? "▾ HIDE ALL EXERCISES"
                        : "▸ SHOW ALL EXERCISES"
                }
            </button>

            ${
                overviewExpanded
                    ? renderOverviewList(workout)
                    : ""
            }

        </div>
    `;

}


function renderOverviewList(workout) {

    return workout.exercises.map(
        (exercise, index) => {

            const completed =
                exercise.completed;

            const skipped =
                exercise.skipped;

            const current =
                index === workout.exerciseIndex;

            const target =
                formatSetRange(exercise);

            return `
                <div class="
                    overview-item
                    ${completed ? "completed" : ""}
                    ${current ? "current" : ""}
                ">

                    <div class="overview-number">
                        ${
                            completed
                                ? "✓"
                                : skipped
                                    ? "–"
                                    : index + 1
                        }
                    </div>

                    <div class="overview-details">

                        <strong>
                            ${escapeHTML(exercise.name)}
                        </strong>

                        <span>
                            ${
                                skipped
                                    ? "Skipped · "
                                    : ""
                            }

                            ${exercise.loggedSets.length}
                            sets completed

                            · Target ${target}
                            × ${escapeHTML(
                                String(exercise.reps ?? "")
                            )}
                        </span>

                    </div>

                </div>
            `;

        }
    ).join("");

}


/* ==========================================================
   31. SET PROGRESS INDICATORS
========================================================== */

function renderSetProgress(
    maxSets,
    completedSets,
    minSets
) {

    let html = "";

    for (
        let index = 0;
        index < maxSets;
        index++
    ) {

        const className =
            index < completedSets
                ? "done"
                : index === completedSets
                    ? "current"
                    : "";

        const optionalClass =
            index >= minSets
                ? " volt-optional-progress"
                : "";

        html += `
            <span class="${className}${optionalClass}"></span>
        `;

    }

    return html;

}


/* ==========================================================
   32. TIMED EXERCISE CONTROL
========================================================== */

export function startTimedSet() {

    if (exerciseTimerRunning) {
        return;
    }

    const workout =
        app?.state?.activeWorkout;

    if (
        !workout ||
        workout.phase !== "exercise"
    ) {
        return;
    }

    exerciseTimerRunning = true;

    const startButton =
        document.getElementById(
            "timedStartBtn"
        );

    const stopButton =
        document.getElementById(
            "timedStopBtn"
        );

    if (startButton) {
        startButton.disabled = true;
    }

    if (stopButton) {
        stopButton.disabled = false;
    }

    startExerciseTimer(
        "exerciseTimerDisplay"
    );

}


export function stopTimedSet() {

    if (!exerciseTimerRunning) {
        return;
    }

    const elapsedSeconds =
        stopExerciseTimer();

    exerciseTimerRunning = false;

    const secondsInput =
        document.getElementById(
            "setSeconds"
        );

    if (secondsInput) {

        secondsInput.value =
            Math.max(
                1,
                Math.round(elapsedSeconds)
            );

    }

    completeSet();

}


/* ==========================================================
   33. PREVIOUS PERFORMANCE
========================================================== */

function getPreviousPerformance(exerciseName) {

    const history =
        app?.state?.history ?? [];

    for (
        let index = history.length - 1;
        index >= 0;
        index--
    ) {

        const workout = history[index];

        const exercise =
            workout.exercises?.find(
                item =>
                    item.name.toLowerCase() ===
                    exerciseName.toLowerCase()
            );

        if (!exercise?.loggedSets?.length) {
            continue;
        }

        return exercise.loggedSets.map(set => {

            if (set.seconds != null) {

                const weight =
                    set.weight > 0
                        ? ` @ ${set.weight}kg`
                        : "";

                return `${set.seconds}s${weight}`;

            }

            return `${set.weight}kg × ${set.reps}`;

        }).join(" · ");

    }

    return null;

}


/* ==========================================================
   34. AUTOMATIC WEIGHT SUGGESTIONS
========================================================== */

function getSuggestedWeightForSet(exercise) {

    // Priority 1:
    // Weight from the immediately preceding set.
    const loggedSets =
        exercise.loggedSets ?? [];

    if (loggedSets.length > 0) {

        const previousSet =
            loggedSets[loggedSets.length - 1];

        return previousSet.weight ?? 0;

    }

    // Priority 2:
    // Last recorded weight for this exercise
    // from a previous workout.
    return getSuggestedWeight(
        exercise.name
    );

}


function getSuggestedRepsForSet(exercise) {

    const loggedSets =
        exercise.loggedSets ?? [];

    if (loggedSets.length > 0) {

        const previousSet =
            loggedSets[loggedSets.length - 1];

        if (previousSet.reps != null) {

            return previousSet.reps;

        }

    }

    return parseRepTarget(
        exercise.reps
    );

}


function getSuggestedWeight(exerciseName) {

    const history =
        app?.state?.history ?? [];

    for (
        let index = history.length - 1;
        index >= 0;
        index--
    ) {

        const workout = history[index];

        const exercise =
            workout.exercises?.find(
                item =>
                    item.name.toLowerCase() ===
                    exerciseName.toLowerCase()
            );

        if (!exercise?.loggedSets?.length) {
            continue;
        }

        const lastSet =
            exercise.loggedSets[
                exercise.loggedSets.length - 1
            ];

        return lastSet.weight ?? 0;

    }

    return 0;

}


/* ==========================================================
   35. RENDER WORKOUT HISTORY
========================================================== */

export function renderHistory(VOLT) {

    app = VOLT;

    const history =
        app.state?.history ?? [];

    const historyCount =
        document.getElementById(
            "historyCount"
        );

    const historyCycles =
        document.getElementById(
            "historyCycles"
        );

    if (historyCount) {

        historyCount.textContent =
            history.length;

    }

    if (historyCycles) {

        historyCycles.textContent =
            app.state?.completedCycles ?? 0;

    }

    renderWorkoutHistoryList(history);

    renderCycleHistory(history);

}


/* ==========================================================
   36. WORKOUT HISTORY LIST
========================================================== */

function renderWorkoutHistoryList(history) {

    const container =
        document.getElementById(
            "historyList"
        );

    if (!container) {
        return;
    }

    if (!history.length) {

        container.innerHTML = `
            <div class="card empty">
                Your completed workouts will appear here.
            </div>
        `;

        return;

    }

    container.innerHTML = history
        .slice()
        .reverse()
        .map(workout => {

            const date = new Date(
                workout.completedAt
            ).toLocaleDateString();

            const summary =
                calculateWorkoutSummary(workout);

            return `
                <button
                    type="button"
                    class="card volt-history-card"
                    onclick="openWorkoutSummary('${escapeHTML(workout.id)}')"
                >

                    <div class="row">

                        <strong>
                            ${escapeHTML(workout.dayName)}
                        </strong>

                        <span class="small muted">
                            ${escapeHTML(date)}
                        </span>

                    </div>

                    <div class="small muted">
                        Cycle ${workout.cycle}
                        · ${summary.totalSets} sets
                        · ${formatDuration(
                            summary.durationSeconds
                        )}
                    </div>

                    <div class="volt-history-volume">
                        ${Math.round(
                            summary.volume
                        ).toLocaleString()} kg volume
                        <span>VIEW SUMMARY →</span>
                    </div>

                </button>
            `;

        })
        .join("");

}


/* ==========================================================
   37. CYCLE HISTORY
========================================================== */

function renderCycleHistory(history) {

    const container =
        document.getElementById(
            "cycleHistory"
        );

    if (!container) {
        return;
    }

    const completedCycles =
        app.state?.completedCycles ?? 0;

    if (!completedCycles) {

        container.innerHTML = `
            <div class="card empty">
                Complete your first rotation
                to unlock cycle summaries.
            </div>
        `;

        return;

    }

    const cycleGroups = new Map();

    history.forEach(workout => {

        const cycle = workout.cycle;

        if (!cycleGroups.has(cycle)) {
            cycleGroups.set(cycle, []);
        }

        cycleGroups.get(cycle).push(workout);

    });

    const completed = [...cycleGroups.entries()]
        .filter(
            ([cycle]) =>
                cycle <= completedCycles
        )
        .reverse();

    container.innerHTML = completed.map(
        ([cycle, workouts]) => {

            const totalSets =
                workouts.reduce(
                    (total, workout) =>
                        total +
                        getTotalSets(workout),
                    0
                );

            const volume =
                workouts.reduce(
                    (total, workout) =>
                        total +
                        calculateWorkoutSummary(
                            workout
                        ).volume,
                    0
                );

            return `
                <div class="card">

                    <div class="row">

                        <h3>
                            Cycle ${cycle}
                        </h3>

                        <span class="pill">
                            COMPLETE
                        </span>

                    </div>

                    <div class="small muted">
                        ${workouts.length} workouts
                        · ${totalSets} sets
                    </div>

                    <div class="big">
                        ${Math.round(
                            volume
                        ).toLocaleString()} kg
                    </div>

                    <div class="small muted">
                        Total training volume
                    </div>

                </div>
            `;

        }
    ).join("");

}


/* ==========================================================
   38. NORMALISE EXISTING WORKOUTS
========================================================== */

function normalizeActiveWorkout(workout) {

    let changed = false;

    workout.exercises.forEach(exercise => {

        const range =
            parseSetRange(exercise.sets);

        if (
            exercise.minSets !== range.min ||
            exercise.maxSets !== range.max
        ) {

            exercise.minSets = range.min;
            exercise.maxSets = range.max;

            exercise.prescribedSets = range.min;

            changed = true;

        }

        if (
            !Array.isArray(exercise.loggedSets)
        ) {

            exercise.loggedSets = [];

            changed = true;

        }

        if (
            typeof exercise.skipped !== "boolean"
        ) {

            exercise.skipped = false;

            changed = true;

        }

    });

    if (changed) {
        saveWorkoutState();
    }

}


/* ==========================================================
   39. WORKOUT SUMMARY HELPERS
========================================================== */

function getTotalSets(workout) {

    return workout.exercises.reduce(
        (total, exercise) =>
            total +
            (exercise.loggedSets?.length ?? 0),
        0
    );

}


function parseSetRange(value) {

    const numbers =
        String(value ?? "3")
            .match(/\d+/g)
            ?.map(Number) ?? [];

    if (!numbers.length) {

        return {
            min: 3,
            max: 3
        };

    }

    const first =
        Math.max(1, numbers[0]);

    const second =
        numbers.length > 1
            ? Math.max(first, numbers[1])
            : first;

    return {
        min: first,
        max: second
    };

}


function formatSetRange(exercise) {

    const min =
        exercise.minSets ??
        parseSetRange(exercise.sets).min;

    const max =
        exercise.maxSets ??
        parseSetRange(exercise.sets).max;

    return min === max
        ? String(min)
        : `${min}–${max}`;

}


/* ==========================================================
   40. SAVE WORKOUT STATE
========================================================== */

function saveWorkoutState() {

    if (!app?.state) {
        return;
    }

    try {

        const result =
            saveData(app.state);

        if (result?.catch) {

            result.catch(error => {

                console.error(
                    "Workout save failed:",
                    error
                );

                alert(
                    "Your workout could not be saved. " +
                    "Please export a backup."
                );

            });

        }

    } catch (error) {

        console.error(
            "Workout save failed:",
            error
        );

        alert(
            "Your workout could not be saved."
        );

    }

}


/* ==========================================================
   41. GENERAL HELPERS
========================================================== */

function parseRepTarget(value) {

    const match =
        String(value ?? "8")
            .match(/\d+/);

    return match
        ? Number(match[0])
        : 8;

}


function parseRestSeconds(value) {

    const match =
        String(value ?? "90")
            .match(/\d+/);

    return match
        ? Number(match[0])
        : 90;

}


function isTimedExercise(exercise) {

    const type =
        String(
            exercise.type ?? ""
        ).toLowerCase();

    return (
        type === "time" ||
        type === "timed" ||
        type === "seconds"
    );

}


function readNumber(elementId) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return NaN;
    }

    const value =
        element.value.trim();

    if (value === "") {
        return NaN;
    }

    return Number(value);

}


function formatTime(seconds) {

    const minutes =
        Math.floor(seconds / 60);

    const remainder =
        seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainder).padStart(2, "0")
    );

}


function formatDuration(seconds) {

    const minutes =
        Math.round(
            (seconds ?? 0) / 60
        );

    if (minutes < 60) {

        return `${minutes} min`;

    }

    const hours =
        Math.floor(minutes / 60);

    const remaining =
        minutes % 60;

    return `${hours}h ${remaining}m`;

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


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
        Math.random()
            .toString(36)
            .slice(2)
    );

}