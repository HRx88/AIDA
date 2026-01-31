'''import speech_recognition as sr

print("Microphone names detected:\n")
for i, name in enumerate(sr.Microphone.list_microphone_names()):
    print(f"{i}: {name}")'''

#Code above to check microphone device index 


import speech_recognition as sr

recognizer = sr.Recognizer()                # Creates a recognizer object that handles listening, noise adjustment, and speech recognition
recognizer.pause_threshold = 2           # How long (in seconds) of silence is allowed before the recognizer decides "the user has stopped talking".
recognizer.non_speaking_duration = 0.7      # How much silence (in seconds) is kept at the end of the recording to avoid cutting off the end of the user's speech.

MIC_INDEX = 1   #we will later change the device index in rasberry pi

def calibrate_microphone():
    with sr.Microphone(device_index=MIC_INDEX) as source:
        print("Calibrating... stay quiet for 1.5s")
        recognizer.adjust_for_ambient_noise(source, duration=1.5)   # Listens to background noise for 1.5 seconds to set an appropriate noise threshold


def listen_once(phrase_time_limit=30)-> str | None:     #To ensure function only returns string or None
    
    with sr.Microphone(device_index=MIC_INDEX) as source:
        print("Listening... speak normally (up to 30s)")
        audio = recognizer.listen(source, phrase_time_limit=phrase_time_limit)     # Records audio from the microphone for 30 seconds or until silence is detected

    print("Transcribing...")
    try:
        text = recognizer.recognize_google(audio)       # Sends the audio to Google's speech recognition service and converts it into text
        print("You said:", text)
        return text

    except sr.UnknownValueError:            # Raised when speech was detected but could not be understood
        print("Could not understand audio. Try again.")
        return None
    except sr.RequestError as e:         # Raised when there is an issue with the API request(no internet, rate limiting, service down)
        print("API error:", e)
        return None