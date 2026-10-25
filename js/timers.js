/* ==========================================================
   VOLT TRAINING
   timers.js — Rest & Exercise Timers
   Version 1.2
   ========================================================== */


/* ==========================================================
   1. TIMER STATE
========================================================== */

let restInterval = null;
let restEndTimestamp = null;
let restCompleteCallback = null;
let restCompletionHandled = false;

let exerciseInterval = null;
let exerciseStartTimestamp = null;
let exerciseElapsedBeforePause = 0;
let exerciseRunning = false;


/* ==========================================================
   2. REST TIMER
========================================================== */

/**
 * Starts a countdown to an absolute timestamp.
 *
 * @param {number} endTimestamp
 * @param {Function} onComplete
 */

export function startRestTimer(
    endTimestamp,
    onComplete
) {

    // Remove any previous interval.
    clearRestInterval();

    if (!Number.isFinite(endTimestamp)) {
        console.error("Invalid rest timer timestamp.");
        return;
    }

    restEndTimestamp = endTimestamp;

    restCompleteCallback =
        typeof onComplete === "function"
            ? onComplete
            : null;

    restCompletionHandled = false;

    // Update immediately.
    updateRestTimer();

    // Check whether the timer has already completed.
    if (restCompletionHandled) {
        return;
    }

    // Refresh display periodically.
    restInterval = window.setInterval(
        updateRestTimer,
        250
    );

}


/* ==========================================================
   3. UPDATE REST TIMER
========================================================== */

function updateRestTimer() {

    if (restEndTimestamp === null) {
        return;
    }

    const remainingMilliseconds = Math.max(
        0,
        restEndTimestamp - Date.now()
    );

    const remainingSeconds = Math.ceil(
        remainingMilliseconds / 1000
    );

    const display = document.getElementById(
        "restClock"
    );

    if (display) {

        display.textContent = formatTime(
            remainingSeconds
        );

    }

    updateRestProgress(remainingMilliseconds);

    if (remainingMilliseconds <= 0) {

        completeRestTimer();

    }

}


/* ==========================================================
   4. COMPLETE REST TIMER
========================================================== */

function completeRestTimer() {

    if (restCompletionHandled) {
        return;
    }

    restCompletionHandled = true;

    const callback = restCompleteCallback;

    clearRestInterval();

    restEndTimestamp = null;
    restCompleteCallback = null;

    playTimerNotification();

    if (callback) {

        try {

            callback();

        } catch (error) {

            console.error(
                "Rest completion callback failed:",
                error
            );

        }

    }

}


/* ==========================================================
   5. STOP REST TIMER
========================================================== */

/**
 * Stops the current rest timer.
 *
 * Does not trigger the completion callback.
 */

export function stopTimer() {

    clearRestInterval();

    restEndTimestamp = null;
    restCompleteCallback = null;
    restCompletionHandled = false;

}


/* ==========================================================
   6. CLEAR REST INTERVAL
========================================================== */

function clearRestInterval() {

    if (restInterval !== null) {

        window.clearInterval(restInterval);

        restInterval = null;

    }

}


/* ==========================================================
   7. REST TIMER PROGRESS
========================================================== */

function updateRestProgress(remainingMilliseconds) {

    const progressBar = document.getElementById(
        "restProgressFill"
    );

    if (!progressBar) {
        return;
    }

    const totalMilliseconds = Number(
        progressBar.dataset.duration
    );

    if (
        !Number.isFinite(totalMilliseconds) ||
        totalMilliseconds <= 0
    ) {
        return;
    }

    const percentage = Math.max(
        0,
        Math.min(
            100,
            (
                remainingMilliseconds /
                totalMilliseconds
            ) * 100
        )
    );

    progressBar.style.width = `${percentage}%`;

}


/* ==========================================================
   8. ADJUST REST TIMER
========================================================== */

/**
 * Adds or subtracts seconds from the current timer.
 *
 * The workout module should also update the saved
 * restEndsAt timestamp.
 */

export function adjustRestTimer(seconds) {

    if (restEndTimestamp === null) {
        return null;
    }

    if (!Number.isFinite(seconds)) {
        return restEndTimestamp;
    }

    restEndTimestamp = Math.max(
        Date.now(),
        restEndTimestamp + seconds * 1000
    );

    updateRestTimer();

    return restEndTimestamp;

}


/* ==========================================================
   9. RESTORE TIMER AFTER APP SUSPENSION
========================================================== */

/**
 * Called when VOLT opens or returns to the foreground.
 *
 * Uses the saved restEndsAt timestamp from activeWorkout.
 */

export function restoreTimer(VOLT) {

    const workout =
        VOLT?.state?.activeWorkout;

    if (!workout) {

        stopTimer();

        return;

    }

    if (
        workout.phase !== "rest" ||
        !Number.isFinite(workout.restEndsAt)
    ) {

        stopTimer();

        return;

    }

    /*
       If the rest period has already finished,
       we update the saved workout state directly.

       This avoids depending on a timer callback that
       may no longer exist after the app was closed.
    */

    if (Date.now() >= workout.restEndsAt) {

        stopTimer();

        workout.phase = "exercise";
        workout.restEndsAt = null;

        try {

            const serialized = JSON.stringify(
                VOLT.state
            );

            localStorage.setItem(
                "volt_training_v1",
                serialized
            );

        } catch (error) {

            console.error(
                "Could not save restored timer state:",
                error
            );

        }

        return;

    }

    /*
       A callback is not registered here because
       workouts.js is responsible for progressing
       between sets.

       When the workout screen renders, it calls
       startRestTimer() with the appropriate callback.
    */

    startRestTimer(
        workout.restEndsAt,
        null
    );

}


/* ==========================================================
   10. EXERCISE STOPWATCH
========================================================== */

/**
 * Starts timing a set.
 *
 * Used for:
 * - Dead hangs
 * - Planks
 * - Wall sits
 * - Other timed exercises
 */

export function startExerciseTimer(
    displayId = "exerciseTimerDisplay"
) {

    if (exerciseRunning) {
        return;
    }

    clearExerciseInterval();

    exerciseStartTimestamp = Date.now();

    exerciseElapsedBeforePause = 0;

    exerciseRunning = true;

    updateExerciseTimer(displayId);

    exerciseInterval = window.setInterval(
        () => updateExerciseTimer(displayId),
        100
    );

}


/* ==========================================================
   11. UPDATE EXERCISE STOPWATCH
========================================================== */

function updateExerciseTimer(displayId) {

    if (!exerciseRunning) {
        return;
    }

    const elapsedMilliseconds =
        exerciseElapsedBeforePause +
        (
            Date.now() -
            exerciseStartTimestamp
        );

    const elapsedSeconds =
        elapsedMilliseconds / 1000;

    const display = document.getElementById(
        displayId
    );

    if (display) {

        display.textContent = formatTime(
            Math.floor(elapsedSeconds)
        );

    }

}


/* ==========================================================
   12. STOP EXERCISE TIMER
========================================================== */

/**
 * Stops the exercise timer and returns
 * the elapsed time in seconds.
 */

export function stopExerciseTimer() {

    if (!exerciseRunning) {
        return exerciseElapsedBeforePause / 1000;
    }

    const elapsedMilliseconds =
        exerciseElapsedBeforePause +
        (
            Date.now() -
            exerciseStartTimestamp
        );

    clearExerciseInterval();

    exerciseRunning = false;

    exerciseStartTimestamp = null;

    exerciseElapsedBeforePause =
        elapsedMilliseconds;

    return elapsedMilliseconds / 1000;

}


/* ==========================================================
   13. RESET EXERCISE TIMER
========================================================== */

export function resetExerciseTimer() {

    clearExerciseInterval();

    exerciseRunning = false;

    exerciseStartTimestamp = null;

    exerciseElapsedBeforePause = 0;

    const display = document.getElementById(
        "exerciseTimerDisplay"
    );

    if (display) {
        display.textContent = "00:00";
    }

}


/* ==========================================================
   14. CLEAR EXERCISE INTERVAL
========================================================== */

function clearExerciseInterval() {

    if (exerciseInterval !== null) {

        window.clearInterval(exerciseInterval);

        exerciseInterval = null;

    }

}


/* ==========================================================
   15. GET CURRENT TIMER VALUES
========================================================== */

export function getRestRemaining() {

    if (restEndTimestamp === null) {
        return 0;
    }

    return Math.max(
        0,
        Math.ceil(
            (
                restEndTimestamp - Date.now()
            ) / 1000
        )
    );

}


export function getExerciseElapsed() {

    if (!exerciseRunning) {

        return exerciseElapsedBeforePause / 1000;

    }

    return (
        exerciseElapsedBeforePause +
        (
            Date.now() -
            exerciseStartTimestamp
        )
    ) / 1000;

}


/* ==========================================================
   16. TIMER NOTIFICATIONS
========================================================== */

/**
 * Attempts to vibrate when a rest timer finishes.
 *
 * Vibration support varies by device and browser.
 */

function playTimerNotification() {

    try {

        if (
            "vibrate" in navigator &&
            typeof navigator.vibrate === "function"
        ) {

            navigator.vibrate([150, 100, 150]);

        }

    } catch (error) {

        console.warn(
            "Timer notification unavailable:",
            error
        );

    }

}


/* ==========================================================
   17. TIME FORMATTING
========================================================== */

export function formatTime(totalSeconds) {

    const safeSeconds = Math.max(
        0,
        Math.floor(
            Number(totalSeconds) || 0
        )
    );

    const minutes = Math.floor(
        safeSeconds / 60
    );

    const seconds = safeSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );

}


/* ==========================================================
   18. PAGE VISIBILITY HANDLING
========================================================== */

/*
   iOS may suspend JavaScript while the app is
   in the background.

   When the app becomes visible again, we
   recalculate timers using real timestamps.
*/

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.visibilityState !== "visible") {
            return;
        }

        if (restEndTimestamp !== null) {

            updateRestTimer();

        }

        if (exerciseRunning) {

            updateExerciseTimer(
                "exerciseTimerDisplay"
            );

        }

    }
);


/* ==========================================================
   19. CLEANUP
========================================================== */

window.addEventListener(
    "pagehide",
    () => {

        clearRestInterval();

        clearExerciseInterval();

    }
);