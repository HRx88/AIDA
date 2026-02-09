

// ===== Calendar-service API base =====
// Call calendar THROUGH Flask proxy (same origin). Works in Docker + local.
const CALENDAR_API_BASE = "/calendar"; // keep empty so we can use relative URLs
const CALENDAR_API = "/calendar/api"; // proxy route in Flask



let lastUserSpokeAt = 0;

let nudgeTimeout = null;
let nudgeCount = 0;
let lastNudgeAt = 0;
let isSpeaking = false;

// tune knobs
const NUDGE_CONFIG = {
  firstDelayMs: 1500,          // speak soon after page load
  minSilentBeforeFirstMs: 1500, // allow instant “hi” even if user didn’t speak
  minGapMs: 25000,             // minimum time between nudges (25s)
  maxGapMs: 45000,             // max time between nudges (45s)
  maxPerSession: 4,            // cap to prevent token burn
};

// Temporary: hardcoded user id for testing (later you pull from login/session)
const USER_ID = 2;

const ACTION_RULES = [
  { keywords: ["brush", "teeth"], icon: "🦷", action: "hygiene_brush" },
  { keywords: ["shower"], icon: "🚿", action: "hygiene_wash" },
  { keywords: ["wash face"], icon: "💦", action: "hygiene_wash" },
  { keywords: ["toilet"], icon: "🚽", action: "toilet" },

  { keywords: ["cook", "eat", "breakfast", "lunch", "dinner"], icon: "🍳", action: "food" },
  { keywords: ["medicine", "medication", "pill"], icon: "💊", action: "medicine" },

  { keywords: ["laundry"], icon: "🧺", action: "laundry" },
  { keywords: ["vacuum"], icon: "🧹", action: "cleaning" },
  { keywords: ["clean"], icon: "🧹", action: "cleaning" },
  { keywords: ["trash", "rubbish"], icon: "🗑", action: "trash" },
  { keywords: ["dishes", "wash dishes", "dish"], icon: "🍽", action: "dishes" },
  { keywords: ["mop"], icon: "🧼", action: "cleaning" },

  { keywords: ["run", "jog"], icon: "🏃", action: "exercise_run" },
  { keywords: ["walk"], icon: "🚶", action: "exercise_walk" },
  { keywords: ["stretch"], icon: "🤸", action: "exercise_stretch" },
  { keywords: ["lift", "weights", "gym"], icon: "🏋️", action: "exercise_lift" },
  { keywords: ["yoga"], icon: "🧘", action: "exercise_yoga" },
  { keywords: ["exercise"], icon: "💪", action: "exercise_generic" },

  { keywords: ["music"], icon: "🎧", action: "music" },
  { keywords: ["tv"], icon: "📺", action: "tv" },
  { keywords: ["relax"], icon: "🌿", action: "relax" },

  { keywords: ["call"], icon: "📞", action: "call" },
  { keywords: ["appointment"], icon: "📅", action: "appointment" },
  { keywords: ["wake", "alarm"], icon: "⏰", action: "wake" },
];

function getSessionId() {
  let sid = sessionStorage.getItem("aidaSessionId");
  if (!sid) {
    sid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem("aidaSessionId", sid);
  }
  return sid;
}

async function getCurrentTaskContext() {
  const currentTaskId = Number(sessionStorage.getItem("currentTaskId"));
  let taskTitle = "Task";
  let taskAction = "idle";

  if (currentTaskId) {
    const data = await fetchTodayStatus(USER_ID, getTodaySG());
    const t = data.tasks.find(x => x.id === currentTaskId);
    if (t?.title) taskTitle = t.title;
  }

  const visuals = pickTaskVisuals(taskTitle);
  taskAction = visuals.action;

  return { taskTitle, taskAction, taskId: currentTaskId };
}

// Helpers
function $(sel) { return document.querySelector(sel); }

function getTodaySG() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function formatTimeHHMM(dateObj) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}

// ===== API Calls =====
async function fetchTodayStatus(userId, dateStr) {
  // This hits calendar-service taskLogController.getTodayStatus
  const url = `${CALENDAR_API}/logs/today/${userId}?date=${encodeURIComponent(dateStr)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetchTodayStatus failed: ${res.status} ${text}`);
  }
  return res.json(); // { date, tasks:[...], summary:{...} }
}

function pickCurrentTask(tasksWithStatus) {
  const pending = tasksWithStatus.filter(t => !t.isCompleted);
  if (pending.length === 0) return null;

  pending.sort((a, b) => {
    const ta = a.time_slot || "99:99";
    const tb = b.time_slot || "99:99";
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return (a.order_index || 0) - (b.order_index || 0);
  });

  // Try to pick the first task that is >= current time (SG)
  const now = new Date();
  const sg = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const nowHHMM = formatTimeHHMM(sg);

  const upcoming = pending.find(t => (t.time_slot || "99:99").slice(0,5) >= nowHHMM);
  return upcoming || pending[0]; // fallback: earliest pending
}

function pickNextTask(tasksWithStatus, currentTaskId) {
  const pending = tasksWithStatus.filter(t => !t.isCompleted);

  if (!currentTaskId) {
    pending.sort((a, b) => {
      const ta = a.time_slot || "99:99";
      const tb = b.time_slot || "99:99";
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return (a.order_index || 0) - (b.order_index || 0);
    });
    return pending[0] || null;
  }

  // Find current in the ordered list, then return the next one
  const ordered = [...tasksWithStatus].sort((a, b) => {
    const ta = a.time_slot || "99:99";
    const tb = b.time_slot || "99:99";
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return (a.order_index || 0) - (b.order_index || 0);
  });

  const idx = ordered.findIndex(t => t.id === currentTaskId);
  for (let i = idx + 1; i < ordered.length; i++) {
    if (!ordered[i].isCompleted) return ordered[i];
  }
  return null;
}

// ===== Shared UI utilities =====
function startLiveClock(targetSelector) {
  const el = $(targetSelector);
  if (!el) return;

  const tick = () => {
    const now = new Date();
    const sg = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
    el.textContent = formatTimeHHMM(sg);
  };

  tick();
  setInterval(tick, 1000);
}


// ===== Page Initializers =====

// Wake up page: show current time + first task
async function initWakeUpPage() {
  // 1) Always show live clock
  startLiveClock("#currentTime");

  // 2) Always show name (even if no tasks)
  const nameEl = $("#userName");
  if (nameEl) nameEl.textContent = "Charlie"; // later: pull from DB/login

  // 3) Fetch schedule
  const dateStr = getTodaySG();
  const data = await fetchTodayStatus(USER_ID, dateStr);

  // 4) Pick current task (first pending)
  const currentTask = pickCurrentTask(data.tasks);

  // Grab UI elements once
  const taskEl = $("#firstTaskTitle");
  const speechEl = $("#speechTaskTitle");
  const iconEl = $("#taskIcon");

  const startBtn = $("#startBtn");

  // 5) If no task -> show friendly message and exit
  if (!currentTask) {
    if (taskEl) taskEl.textContent = "No tasks scheduled 🎉";
    if (speechEl) speechEl.textContent = "You’re all set for today!";
    if (iconEl) iconEl.textContent = "🎉";
    if (startBtn) startBtn.disabled = true;
    await speakText("Good morning Charlie. You’re all set for today!");
    sessionStorage.removeItem("currentTaskId");
    return;
  }

  // task exists
  if (startBtn) startBtn.disabled = false;

  // 6) If there IS a task -> update UI
  if (speechEl) speechEl.textContent = currentTask.title;
  await sleep(200); // tiny delay so DOM updates
  const wakeLine = `Good morning Charlie. Shall we begin with ${currentTask.title} today?`;
  await speakText(wakeLine);

  if (taskEl) taskEl.textContent = currentTask.title;
  if (iconEl) iconEl.textContent = pickTaskVisuals(currentTask.title).icon;

  // Save current task for next page
  sessionStorage.setItem("currentTaskId", String(currentTask.id));
}

function pickTaskVisuals(title = "") {
  const t = title.toLowerCase();

  for (const rule of ACTION_RULES) {
    if (rule.keywords.some(k => t.includes(k))) {
      return { icon: rule.icon, action: rule.action };
    }
  }

  return { icon: "🔔", action: "idle" };
}

function getAvatarMarkup(action) {
  switch (action) {
    case "hygiene_brush":
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="toothbrush"></div>
        </div>
      `;

    case "food": // ✅ cook/eat/breakfast/lunch/dinner
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="spoon"></div>
          <div class="steam"></div>
        </div>
      `;

    case "laundry":
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="shirt"></div>
        </div>
      `;

    case "appointment":
    case "call":
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="ring"></div>
        </div>
      `;

    case "exercise_walk":
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="feet-walk"></div>
        </div>
      `;

    case "exercise_stretch":
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
          <div class="arms-stretch"></div>
        </div>
      `;

    default:
      return `
        <div class="avatar-stage">
          <div class="face">
            <div class="eyes">
              <div class="eye-closed"></div><div class="eye-closed"></div>
            </div>
            <div class="mouth-open"></div>
          </div>
        </div>
      `;
  }
}

function renderAvatarForTask(taskTitle = "") {
  const avatar = document.querySelector("#aidaAvatar");
  if (!avatar) return;

  const { action } = pickTaskVisuals(taskTitle);


  avatar.dataset.action = action || "idle";
}

function setAvatarMode(mode){
  const avatar = document.querySelector("#aidaAvatar");
  if (avatar) avatar.dataset.mode = mode;
}

// in sttOnce():
/*setAvatarMode("listening");
// after STT:
setAvatarMode("thinking");
// after AI reply:
setAvatarMode("speaking");
// finally:
setAvatarMode("idle");*/

// Task execution page: show the task you’re currently doing
async function initTaskExecutionPage() {

  stopProactiveNudges();
  nudgeCount = 0;
  lastNudgeAt = 0;

  startLiveClock("#currentTime");

  const taskId = Number(sessionStorage.getItem("currentTaskId"));
  if (!taskId) {
    const data = await fetchTodayStatus(USER_ID, getTodaySG());
    const currentTask = pickCurrentTask(data.tasks);
    if (currentTask) sessionStorage.setItem("currentTaskId", String(currentTask.id));
  }

  const currentTaskId = Number(sessionStorage.getItem("currentTaskId"));
  if (!currentTaskId) return;

  const data = await fetchTodayStatus(USER_ID, getTodaySG());
  const currentTask = data.tasks.find(t => t.id === currentTaskId);

  const taskEl = $("#currentTaskTitle");
  if (taskEl) taskEl.textContent = currentTask ? currentTask.title : "Task";

  if (currentTask) {
    renderAvatarForTask(currentTask.title);
  }

  const iconSmall = document.querySelector("#taskIconSmall");
  if (iconSmall && currentTask) {
    iconSmall.textContent = pickTaskVisuals(currentTask.title).icon;
  }

  // ✅ SPEAK IMMEDIATELY (ONCE PER TASK)
  const speakKey = `aida_exec_greet_${currentTaskId}`;
  if (!alreadySpoken(speakKey)) {
    await sleep(600); // allow DOM + avatar to render

    const line = currentTask
      ? `Okay Charlie. Let’s do ${currentTask.title}. I’m right here with you.`
      : `Okay Charlie. I’m right here with you.`;

    const aiEl = document.querySelector("#ai-text");
    if (aiEl) aiEl.textContent = `AIDA: ${line}`;

    await speakText(line);

    // allow first proactive nudge soon if user stays quiet
    lastUserSpokeAt = Date.now() - NUDGE_CONFIG.minSilentBeforeFirstMs;
  }

  
  
  startProactiveNudges();
}

// Transition page: show what’s next
async function initTaskTransitionPage() {
  // Elements that exist in your task_transition.html
  const nextTitleEl = $("#nextTaskTitle");
  const iconEl = $("#nextTaskIcon");
  const speechEl = $("#transitionSpeech");
  const completedEl = $("#completedTaskTitle");

  // Show the task you just finished (saved during DONE click)
  const completedTitle = sessionStorage.getItem("completedTaskTitle");
  if (completedEl && completedTitle) completedEl.textContent = completedTitle;

  const subtitleEl = $("#celebrationSubtitle");
  if (subtitleEl) subtitleEl.textContent = "Keep up the awesome work!";

  // 1) Fetch today tasks
  const data = await fetchTodayStatus(USER_ID, getTodaySG());

  // 2) We should have set this before redirecting here
  const completedTaskId = Number(sessionStorage.getItem("completedTaskId"));

  // 3) Pick the next task AFTER the completed task
  const nextTask = pickNextTask(data.tasks, completedTaskId);

  // 4) If no next task, show "all done"
  if (!nextTask) {
    if (nextTitleEl) nextTitleEl.textContent = "All done for today! 🎉";
    if (iconEl) iconEl.textContent = "🎉";
    if (speechEl) speechEl.textContent = "Awesome work. You’re finished for today!";
    await speakText("Great job! You’re finished for today!");
    sessionStorage.removeItem("currentTaskId");
    return;
  }

  // 5) Update UI dynamically
  if (nextTitleEl) nextTitleEl.textContent = nextTask.title;
  if (iconEl) iconEl.textContent = pickTaskVisuals(nextTask.title).icon;
  if (speechEl) speechEl.textContent = `Nice job! Next: ${nextTask.title}. Ready to start?`;
  const line = `Nice job! Next: ${nextTask.title}. Ready to start?`;
  await speakText(line);

  // 6) IMPORTANT: set the next task as the new current task
  sessionStorage.setItem("currentTaskId", String(nextTask.id));
}






async function getAiReply(userText) {

  
  // UI elements we will update
  const statusEl = document.querySelector("#statusText");
  const aiEl = document.querySelector("#ai-text"); // <-- you must have this in HTML

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  try {
    setStatus("Thinking…");

    const ctx = await getCurrentTaskContext();

    // Call your Flask AI endpoint (you will create /api/ai_reply in Python)
    const res = await fetch("/api/ai_reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: userText,
        sessionId: getSessionId(),
        taskTitle: ctx.taskTitle,
        taskAction: ctx.taskAction,
        taskId: ctx.taskId
      })
    });

    const data = await res.json();

    // Expected response shape:
    // { ok: true, reply: "..." }
    if (!data.ok || !data.reply) {
      setStatus("AIDA had trouble replying. Try again.");
      return null;
    }

    // Show AI reply on the page
    if (aiEl) aiEl.textContent = `AIDA: ${data.reply}`;

    setStatus("Done.");
    return data.reply;

  } catch (err) {
    console.error(err);
    setStatus("AI error. Check console.");
    return null;
  }
}

async function speakText(text) {
  const statusEl = document.querySelector("#statusText");
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  // Prevent overlapping TTS spam
  if (isSpeaking) return false;
  if (!text || !text.trim()) return false;

  try {
    isSpeaking = true;
    setStatus("Speaking…");

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await res.json();   // ✅ moved up

    if (!data.ok) {
      setStatus(data.error || "TTS unavailable.");
      return false;
    }

    setStatus("Ready.");
    return true;

  } catch (err) {
    console.error(err);
    setStatus("TTS error. Check console.");
    return false;
  } finally {
    isSpeaking = false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prevent repeating TTS every refresh
function alreadySpoken(key) {
  const v = sessionStorage.getItem(key);
  if (v === "1") return true;
  sessionStorage.setItem(key, "1");
  return false;
}

// Speak a DOM element’s text after UI updates settle
async function speakElementTextOnce({ key, selector, prefix = "", maxLen = 200 }) {
  try {
    if (alreadySpoken(key)) return;

    // Wait a bit so initWakeUpPage/initTaskTransitionPage can set text
    await sleep(450);

    const el = document.querySelector(selector);
    if (!el) return;

    const raw = (el.textContent || "").trim();
    if (!raw) return;

    // Keep it short so it sounds clean
    const text = (prefix + raw).slice(0, maxLen);

    await speakText(text);
  } catch (e) {
    console.warn("Auto TTS failed:", e);
  }
}

async function getAiNudge() {
  const statusEl = document.querySelector("#statusText");
  const aiEl = document.querySelector("#ai-text");

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  try {
    const ctx = await getCurrentTaskContext();

    const res = await fetch("/api/ai_nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getSessionId(),
        taskTitle: ctx.taskTitle,
        taskAction: ctx.taskAction,
        taskId: ctx.taskId
      })
    });

    const data = await res.json();
    if (!data.ok || !data.reply) return null;

    if (aiEl) aiEl.textContent = `AIDA: ${data.reply}`;
    await speakText(data.reply);

    setStatus("Ready.");
    return data.reply;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function stopProactiveNudges() {
  if (nudgeTimeout) clearTimeout(nudgeTimeout);
  nudgeTimeout = null;
}

window.addEventListener("beforeunload", () => {
  if (typeof stopProactiveNudges === "function") stopProactiveNudges();
});


function scheduleNextNudge(delayMs) {
  stopProactiveNudges();
  nudgeTimeout = setTimeout(async () => {
    const now = Date.now();

    // Stop after cap
    if (nudgeCount >= NUDGE_CONFIG.maxPerSession) return;

    // Don’t interrupt if mic disabled/recording
    const micBtn = document.querySelector(".mic-button");
    if (micBtn && micBtn.disabled) {
      // reschedule a bit later
      return scheduleNextNudge(8000);
    }

    // Don’t speak over itself
    if (isSpeaking) {
      return scheduleNextNudge(6000);
    }

    // Require some idle time since user last spoke
    const idleMs = now - lastUserSpokeAt;

    // For first nudge, allow quick start; after that, require proper silence
    const neededSilence = (nudgeCount === 0)
      ? NUDGE_CONFIG.minSilentBeforeFirstMs
      : NUDGE_CONFIG.minGapMs;

    if (idleMs < neededSilence) {
      // user recently spoke; try again soon
      return scheduleNextNudge(8000);
    }

    // Also ensure gap between nudges
    if (lastNudgeAt && (now - lastNudgeAt < NUDGE_CONFIG.minGapMs)) {
      return scheduleNextNudge(8000);
    }

    // Do the nudge
    const reply = await getAiNudge();
    if (reply) {
      nudgeCount += 1;
      lastNudgeAt = Date.now();
      lastUserSpokeAt = Date.now(); // prevents immediate follow-up spam
    }

    // Schedule next nudge with randomness
    const nextDelay = NUDGE_CONFIG.minGapMs +
      Math.floor(Math.random() * (NUDGE_CONFIG.maxGapMs - NUDGE_CONFIG.minGapMs));

    scheduleNextNudge(nextDelay);

  }, delayMs);
}

function startProactiveNudges() {
  nudgeCount = 0;
  lastNudgeAt = 0;
  scheduleNextNudge(NUDGE_CONFIG.firstDelayMs);
}

async function sttOnce() {
  const micBtn = document.querySelector(".mic-button");
  if (!micBtn) return;

  const statusEl = document.querySelector("#statusText");
  const userEl = document.querySelector("#userText");

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const setUserText = (msg) => { if (userEl) userEl.textContent = msg; };

  try {
    // ✅ stop nudges while user is interacting
    stopProactiveNudges();

    micBtn.disabled = true;
    micBtn.classList.add("recording");

    setAvatarMode?.("listening");
    setStatus("Listening…");
    setUserText("");

    const res = await fetch("/api/stt_once", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrase_time_limit: 30 })
    });

    setAvatarMode?.("thinking");
    setStatus("Transcribing…");

    const data = await res.json();

    if (!data.ok || !data.text) {
      setStatus("I didn’t catch that. Try again.");
      // ✅ user interacted, so reset timer and re-enable nudges
      lastUserSpokeAt = Date.now();
      startProactiveNudges();
      return;
    }

    // user just spoke
    lastUserSpokeAt = Date.now();
    setUserText(`You said: ${data.text}`);
    console.log("User said:", data.text);

    // AI reply
    const aiReply = await getAiReply(data.text);
    if (aiReply) {
      setAvatarMode?.("speaking");
      await speakText(aiReply);
      // ✅ reset idle AFTER reply finishes (prevents instant nudge)
      lastUserSpokeAt = Date.now();
    }

    setAvatarMode?.("idle");
    startProactiveNudges();

  } catch (err) {
    console.error(err);
    setStatus("STT error. Check console.");
    // still restart nudges after error
    lastUserSpokeAt = Date.now();
    startProactiveNudges();
  } finally {
    micBtn.disabled = false;
    micBtn.classList.remove("recording");
    setAvatarMode?.("idle");
  }
}

async function completeCurrentTask() {
  const taskId = Number(sessionStorage.getItem("currentTaskId"));
  if (!taskId) throw new Error("No currentTaskId in sessionStorage");

  const res = await fetch(`${CALENDAR_API}/logs/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      userId: USER_ID,
      // scheduledDate optional; calendar-service will default to SG date anyway
      scheduledDate: getTodaySG(),
      notes: ""
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to complete task");
  }

  return data;
}


document.addEventListener("DOMContentLoaded", async () => {
  // Mic button (keep your existing voice functionality)
  const micBtn = document.querySelector(".mic-button");
  if (micBtn) micBtn.addEventListener("click", sttOnce);

  // Detect which screen we are on (based on body attribute or file name)
  const page = document.body.getAttribute("data-page");

  try {
    if (page === "wake_up") await initWakeUpPage();
    if (page === "task_execution") await initTaskExecutionPage();
    if (page === "task_transition") await initTaskTransitionPage();
  } catch (err) {
    console.error("Page init error:", err);
    const statusEl = $("#statusText");
    if (statusEl) statusEl.textContent = "Error loading schedule. Check console.";
  }

  const startBtn = $("#startBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const id = sessionStorage.getItem("currentTaskId");
      if (!id) {
        const statusEl = $("#statusText");
        if (statusEl) statusEl.textContent = "No task selected yet.";
        return;
      }
      window.location.href = "/task";
    });
  }


  const doneBtn = document.querySelector("#doneBtn");
  if (doneBtn) {
    doneBtn.addEventListener("click", async () => {
      const statusEl = document.querySelector("#statusText");
      const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

      try {
        setStatus("Saving…");
        const data = await fetchTodayStatus(USER_ID, getTodaySG());
        const completedTaskId = Number(sessionStorage.getItem("currentTaskId"));
        const completedTask = data.tasks.find(t => t.id === completedTaskId);

        sessionStorage.setItem("completedTaskId", String(completedTaskId));
        if (completedTask) sessionStorage.setItem("completedTaskTitle", completedTask.title);
        await completeCurrentTask();
        setStatus("Great job! ✅");

        //  stop proactive nudges
        stopProactiveNudges();


        window.location.href = "/task-transition";
      } catch (err) {
        console.error(err);
        setStatus("Could not mark DONE. Check console.");
      }
    });
  }
  
});


