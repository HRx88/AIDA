# app/main.py

from ai.responder import AIResponder
from voice.STT import calibrate_microphone, listen_once
from voice.TTS import speak

def main():
    # 1) Create the AI brain instance (keeps memory)
    brain = AIResponder(current_task="Brush teeth")

    # 2) Calibrate mic once
    calibrate_microphone()

    print("\nSystem ready. Press ENTER to talk. Type 'q' then ENTER to quit.\n")

    while True:
        cmd = input(">> ").strip().lower()
        if cmd == "q":
            print("Exiting.")
            break

        # 3) STT: get user speech as text
        user_text = listen_once(phrase_time_limit=30)
        if not user_text:
            speak("I didn’t catch that. Can you say it again?")
            continue

        # 4) AI: generate response text
        ai_text = brain.respond(user_text)

        # 5) TTS: speak it
        print("AI:", ai_text)
        speak(ai_text)

        # 6) Optional: allow voice quit as well
        if "quit" in user_text.lower() or "stop" in user_text.lower():
            break

if __name__ == "__main__":
    main()
