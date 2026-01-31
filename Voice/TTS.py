# voice/TTS.py
import pyttsx3

def speak(text: str):
    """
    Reliable Windows demo version:
    - Create a fresh engine each time to avoid pyttsx3 getting stuck after first run.
    """
    if not text:
        return

    engine = pyttsx3.init()

    # Optional: slow down slightly for clarity
    # engine.setProperty("rate", 170)

    engine.say(text)
    engine.runAndWait()

    # Clean shutdown so it doesn't "hang" for the next call
    engine.stop()