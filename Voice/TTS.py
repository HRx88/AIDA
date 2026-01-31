import pyttsx3

engine = pyttsx3.init()

def init_tts():
    """Create the TTS engine once (faster and more stable)."""
    global _engine
    if _engine is None:
        _engine = pyttsx3.init()

def speak(text: str):
    """Speak any text string out loud."""
    if not text:
        return
    init_tts()
    _engine.say(text)
    _engine.runAndWait()