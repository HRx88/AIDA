# app/main.py
from flask import Flask, jsonify, request, render_template
from threading import Thread, Lock

from voice.STT import calibrate_microphone, listen_once
from voice.TTS import speak
from ai.responder import AIResponder
from ai.intents import INTENT_KEYWORDS


app = Flask(__name__, template_folder="../ui/screens", static_folder="../ui/static")

# Create ONE AI brain instance (keeps conversation history)
#brain = AIResponder(current_task="Brush teeth")
brains = {}  # sessionId -> AIResponder

def get_brain(session_id: str, task_title: str | None = None):
    if not session_id:
        session_id = "default"
    if session_id not in brains:
        brains[session_id] = AIResponder(current_task=task_title or "your task")
    if task_title:
        brains[session_id].set_task(task_title)
    return brains[session_id]

# Calibrate once at startup (optional but recommended)
calibrate_microphone()

# Prevent overlapping TTS calls (pyttsx3 can glitch if called concurrently)
tts_lock = Lock()

def detect_intent(text: str) -> str:
    """Simple keyword intent classifier (rule-based)."""
    t = (text or "").lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(k in t for k in keywords):
            return intent
    return "unknown"

def speak_async(text: str):
    """Run TTS safely in a background thread."""
    with tts_lock:
        speak(text)

@app.get("/task")
def task_page():
    return render_template("task_execution.html")

@app.get("/wake")
def wake_page():
    return render_template("wake_up.html")

@app.get("/task-transition")
def transition_page():
    return render_template("task_transition.html")

@app.post("/api/stt_once")
def api_stt_once():
    # You can allow JS to pass a time limit if you want
    limit = request.json.get("phrase_time_limit", 30) if request.is_json else 30

    text = listen_once(phrase_time_limit=limit)
    if text is None:
        return jsonify({"ok": False, "text": None}), 200

    return jsonify({"ok": True, "text": text}), 200



@app.post("/api/ai_reply")
def api_ai_reply():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    user_text = (request.json.get("text") or "").strip()
    session_id = request.json.get("sessionId") or "default"
    task_title = request.json.get("taskTitle")
    task_action = request.json.get("taskAction")

    if not user_text:
        return jsonify({"ok": False, "error": "Missing 'text'"}), 400

    # Optional: update current task dynamically
    #if task_title:
       # brain.set_task(task_title)

    intent = detect_intent(user_text)

    brain = get_brain(session_id, task_title)

    # Ask Gemini for a reply
    ai_text = brain.respond(
        user_text,
        task_title=request.json.get("taskTitle"),
        task_action=request.json.get("taskAction"),
        intent=intent,
        mode="reply"
    )

    return jsonify({"ok": True, "reply": ai_text, "intent": intent,"task":task_title,"action":task_action}), 200


@app.post("/api/ai_nudge")
def api_ai_nudge():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    session_id = request.json.get("sessionId") or "default"
    task_title = request.json.get("taskTitle") or "Task"
    task_action = request.json.get("taskAction")

    # keep brain aligned
    #if task_title:
        #brain.set_task(task_title)

    brain = get_brain(session_id, task_title)

    ai_text = brain.nudge(task_title=task_title, task_action=task_action)
    return jsonify({"ok": True, "reply": ai_text}), 200



@app.post("/api/tts")
def api_tts():
    """Frontend sends {text: '...'} and backend speaks it."""
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    text = (request.json.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "Missing 'text'"}), 400

    Thread(target=speak_async, args=(text,), daemon=True).start()
    return jsonify({"ok": True}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
