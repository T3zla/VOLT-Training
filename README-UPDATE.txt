VOLT 1.4

1. Replace your existing VOLT-Training folder with this updated folder.
2. Run your local server as before (python3 -m http.server 8000).
3. In browser DevTools Console, run:
   localStorage.removeItem("volt_training_v1"); location.reload();
4. The new default program starts on A. Press Start Workout to see its warm-up.
5. If an older version appears, use a hard refresh or DevTools > Application > Service Workers > Unregister, then reload.

Warm-ups have a checklist and timers for timed movements. Exercise alternatives appear as dropdowns. Exercise info is available from the info button. Illustrated exercise guides are not included yet.
