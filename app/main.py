# app/main.py
# Voice-only server — runs on the HOST machine (not Docker)
# Provides STT and TTS endpoints that require host audio hardware
from flask import Flask, jsonify, request
from flask_cors import CORS
from threading import Lock

from voice.STT import calibrate_microphone, listen_once

import platform
if platform.system() == "Linux":
    from voice.TTS_rpi import speak   # espeak + pw-play (Bluetooth)
else:
    from voice.TTS import speak       # pyttsx3 (Windows SAPI)

app = Flask(__name__)
CORS(app)  # Allow cross-origin from Docker containers

# Calibrate once at startup
calibrate_microphone()

# Prevent overlapping TTS calls (pyttsx3 can glitch if called concurrently)
tts_lock = Lock()

def speak_async(text: str):
    """Run TTS safely in a background thread."""
    with tts_lock:
        speak(text)


@app.get("/health")
def health():
    return jsonify({"service": "voice-server", "status": "running", "host": True}), 200


@app.post("/api/stt_once")
def api_stt_once():
    limit = request.json.get("phrase_time_limit", 30) if request.is_json else 30
    text = listen_once(phrase_time_limit=limit)
    if text is None:
        return jsonify({"ok": False, "text": None}), 200
    return jsonify({"ok": True, "text": text}), 200


@app.post("/api/tts")
def api_tts():
    """Frontend sends {text: '...'} and backend speaks it."""
    if not request.is_json:
        return jsonify({"ok": False, "error": "Expected JSON body"}), 400

    text = (request.json.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "Missing 'text'"}), 400

    from threading import Thread
    Thread(target=speak_async, args=(text,), daemon=True).start()
    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
