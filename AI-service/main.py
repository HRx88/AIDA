# AI-service/main.py
# Dockerized Flask service: serves UI pages, AI endpoints, proxies calendar & voice
import os
import requests
from flask import Flask, jsonify, request, render_template, Response
from threading import Lock

# AI modules (copied into Docker image)
from ai.responder import AIResponder
from ai.intents import INTENT_KEYWORDS

# Resolve paths relative to THIS file (works in Docker and locally)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "ui", "screens")
STATIC_DIR   = os.path.join(BASE_DIR, "ui", "static")

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR, static_url_path="/static")

# ── Service URLs (Docker internal network) ──────────────────────────
CALENDAR_BASE_URL = os.getenv("CALENDAR_BASE_URL", "http://localhost:5003")
VOICE_SERVER_URL  = os.getenv("VOICE_SERVER_URL",  "http://localhost:5000")

# ── AI Brain pool (one per session) ─────────────────────────────────
brains = {}  # sessionId -> AIResponder

def get_brain(session_id: str, task_title: str | None = None):
    if not session_id:
        session_id = "default"
    if session_id not in brains:
        brains[session_id] = AIResponder(current_task=task_title or "your task")
    if task_title:
        brains[session_id].set_task(task_title)
    return brains[session_id]

def detect_intent(text: str) -> str:
    """Simple keyword intent classifier (rule-based)."""
    t = (text or "").lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(k in t for k in keywords):
            return intent
    return "unknown"

# ── Calendar proxy ──────────────────────────────────────────────────
@app.route("/calendar/api/<path:path>", methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"])
def proxy_calendar(path):
    url = f"{CALENDAR_BASE_URL}/api/{path}"
    headers = {k: v for k, v in request.headers if k.lower() not in ("host", "content-length")}

    payload_json = request.get_json(silent=True) if request.is_json else None
    payload_data = request.get_data() if not request.is_json else None

    resp = requests.request(
        method=request.method,
        url=url,
        params=request.args,
        json=payload_json,
        data=payload_data,
        headers=headers,
        cookies=request.cookies,
        timeout=20,
    )

    excluded = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    out_headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded]
    return Response(resp.content, resp.status_code, out_headers)

# ── Voice proxy (forward to host voice server) ──────────────────────
@app.post("/api/stt_once")
def proxy_stt():
    """Forward STT request to the host voice server."""
    try:
        body = request.get_json(silent=True) or {}
        resp = requests.post(
            f"{VOICE_SERVER_URL}/api/stt_once",
            json=body,
            timeout=60,
        )
        return Response(resp.content, resp.status_code,
                        {"Content-Type": "application/json"})
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Voice server not reachable. Is it running on the host?"}), 503

@app.post("/api/tts")
def proxy_tts():
    """Forward TTS request to the host voice server."""
    try:
        body = request.get_json(silent=True) or {}
        resp = requests.post(
            f"{VOICE_SERVER_URL}/api/tts",
            json=body,
            timeout=30,
        )
        return Response(resp.content, resp.status_code,
                        {"Content-Type": "application/json"})
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Voice server not reachable. Is it running on the host?"}), 503

# ── AI endpoints ────────────────────────────────────────────────────
@app.post("/api/ai_reply")
def api_ai_reply():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    user_text   = (request.json.get("text") or "").strip()
    session_id  = request.json.get("sessionId") or "default"
    task_title  = request.json.get("taskTitle")
    task_action = request.json.get("taskAction")
    user_name   = request.json.get("userName") or "Friend"

    if not user_text:
        return jsonify({"ok": False, "error": "Missing 'text'"}), 400

    intent = detect_intent(user_text)
    brain  = get_brain(session_id, task_title)

    ai_text = brain.respond(
        user_text,
        task_title=task_title,
        task_action=task_action,
        intent=intent,
        mode="reply",
        user_name=user_name
    )

    return jsonify({"ok": True, "reply": ai_text, "intent": intent,
                    "task": task_title, "action": task_action}), 200

@app.post("/api/ai_nudge")
def api_ai_nudge():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    session_id  = request.json.get("sessionId") or "default"
    task_title  = request.json.get("taskTitle") or "Task"
    task_action = request.json.get("taskAction")
    user_name   = request.json.get("userName") or "Friend"

    brain   = get_brain(session_id, task_title)
    ai_text = brain.nudge(task_title=task_title, task_action=task_action, user_name=user_name)
    return jsonify({"ok": True, "reply": ai_text}), 200

# ── UI page routes ──────────────────────────────────────────────────
@app.get("/wake")
def wake_page():
    return render_template("wake_up.html")

@app.get("/task")
def task_page():
    return render_template("task_execution.html")

@app.get("/task-transition")
def transition_page():
    return render_template("task_transition.html")

# ── Health check for Docker ─────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({"service": "ai-service", "status": "running"}), 200

# ── Run ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("AI_SERVICE_PORT", 5010))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
