# voice/TTS_rpi.py — RPi-compatible TTS (uses espeak + PipeWire)
# Writes to a temp WAV file first, then plays via pw-play to avoid
# the stuttering that occurs when piping espeak directly.

import subprocess
import os
import tempfile


def speak(text: str):
    """Speak text using espeak on RPi, routing through PipeWire."""
    if not text:
        return

    # Write espeak output to a temp WAV file
    wav_path = os.path.join(tempfile.gettempdir(), "aida_tts.wav")

    try:
        # Generate WAV from espeak
        subprocess.run(
            ["espeak", "--stdout", "-s", "160", text],
            stdout=open(wav_path, "wb"),
            stderr=subprocess.DEVNULL,
            check=True,
        )

        # Play through PipeWire (routes to default sink = JBL Bluetooth)
        subprocess.run(
            ["pw-play", wav_path],
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except FileNotFoundError:
        # Fallback: try direct espeak (will use whatever ALSA default is)
        subprocess.run(["espeak", "-s", "160", text], check=False)
    except Exception as e:
        print(f"[TTS_rpi] Error: {e}")
    finally:
        # Clean up temp file
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass
