# AI/responder.py
import os
from google import genai

SYSTEM_PROMPT = """
You are a supportive task companion for a person with intellectual disability (PWID).
Rules:
- Use simple, short sentences.
- Give one instruction at a time.
- Be kind and encouraging.
- If the user seems confused, rephrase more simply.
- Avoid sarcasm, complex metaphors, or long paragraphs.
- If user says "stop" or "quit", politely end.
"""

class AIResponder:
    """
    Dynamic AI 'brain' backed by Gemini API.
    Stores a short conversation history so replies stay contextual.
    """

    def __init__(self, current_task: str = "your task"):  #Set up AIResponder class with optional current_task parameter
        api_key = os.getenv("GEMINI_API_KEY") #load API key
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY env var. Set it before running.")

        self.client = genai.Client(api_key=api_key) #connects to Gemini servers
        self.current_task = current_task    #stores task user is currently doing to monitor their progress

        # Conversation memory as a list of turns (strings).
        # We’ll build a prompt each time that includes recent history.
        # This is needed for conversation continuity
        self.history: list[tuple[str, str]] = []  # [] prepares an empty list to store conversation history

    def set_task(self, task: str):
        self.current_task = task    #stores task user is currently doing for AI to reference

    def respond(self, user_text: str) -> str:
        user_text = (user_text or "").strip()  #handle empty input
        if not user_text:
            return "I didn’t catch that. Can you say it again?" #no API call wasted on empty input

        # Adds message to memory
        self.history.append(("user", user_text))

        # Build a compact prompt (system rules + task + recent turns)
        task_hint = f"Current task: {self.current_task}"
        recent = self.history[-10:]  # only keep last 10 messages(Faster, cheaper, less token usage)

        #Converts convo history that is stored as a list into clean readable text
        #for AI to understand
        conversation_block = "\n".join(
            [f"{role.upper()}: {text}" for role, text in recent]
        )

        #Three parts to the prompt: system instructions, current task, convo history
        prompt = f"""{SYSTEM_PROMPT}
        {task_hint}
        Conversation so far:
        {conversation_block}
        ASSISTANT:"""

        # Call Gemini model
        # Model names can change over time; start with a fast/cheap “Flash” model.
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,                                #Send prompt to Gemini API
        )

        ai_text = (response.text or "").strip() #Extracts AI's reply from response object
        if not ai_text:
            ai_text = "Sorry, I’m not sure. Can you say that again?"

        # Store AI's reply in conversation history
        self.history.append(("assistant", ai_text))   #Helps conversation feels continuous.

        return ai_text

'''Things i feel are missing:
- Link to STT feature in STT.py to gather user input to respond to
- Link to TTS to read out AI's response
- How to call out an actual API key(should it be in this file or elsewhere?)
- Missing a connedction to intents.py to classify user input and adjust AI response accordingly

'''