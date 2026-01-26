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

    def __init__(self, current_task: str = "your task"):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY env var. Set it before running.")

        self.client = genai.Client(api_key=api_key)
        self.current_task = current_task

        # Conversation memory as a list of turns (strings).
        # We’ll build a prompt each time that includes recent history.
        self.history: list[tuple[str, str]] = []  # (role, text)

    def set_task(self, task: str):
        self.current_task = task

    def respond(self, user_text: str) -> str:
        user_text = (user_text or "").strip()
        if not user_text:
            return "I didn’t catch that. Can you say it again?"

        # Save user message
        self.history.append(("user", user_text))

        # Build a compact prompt (system rules + task + recent turns)
        task_hint = f"Current task: {self.current_task}"
        recent = self.history[-10:]  # keep it short (cost + speed)

        conversation_block = "\n".join(
            [f"{role.upper()}: {text}" for role, text in recent]
        )

        prompt = f"""{SYSTEM_PROMPT}
{task_hint}

Conversation so far:
{conversation_block}

ASSISTANT:"""

        # Call Gemini model
        # Model names can change over time; start with a fast/cheap “Flash” model.
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        ai_text = (response.text or "").strip()
        if not ai_text:
            ai_text = "Sorry, I’m not sure. Can you say that again?"

        # Save assistant reply
        self.history.append(("assistant", ai_text))

        return ai_text
