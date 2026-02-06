# AI/responder.py
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()  # loads variables from .env into os.environ

SYSTEM_PROMPT = """
You are AIDA, a supportive task companion for a person with intellectual disability (PWID).

Core rules:
- Use short sentences.
- Be kind and encouraging.
- Give ONE instruction at a time.
- Respond to what the user said, THEN gently guide back to the task.
- Do not lecture. Do not be robotic.
- Avoid "I cannot" / "I do not". Just answer naturally.
- Keep replies 1–3 short sentences.

Style format (must follow):
1) Acknowledge user message (1 short sentence).
2) Tie back to the current task + give one next step (1–2 short sentences).

Task guidance rules:
- If the task is broad (e.g. cooking, cleaning), do NOT assume details.
- If details are missing, ask ONE simple clarifying question.
- If the user mentions something specific (e.g. steak, soup, TV), respond to that naturally.

Focus rules:
- You may briefly acknowledge off-task topics (TV, games, feelings).
- Always gently return to the current task after acknowledging.
- Never start a new topic unrelated to the task.

Motivation rules:
- Give encouragement that is specific to the current task.
- Avoid generic motivational quotes.
- Keep motivation short and practical.

Nudge rules:
- When nudging, do not repeat previous instructions.
- Offer ONE small next step or reminder.
- Do not ask questions during nudges.
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

    def respond(self,user_text: str,task_title: str | None = None,task_action: str | None = None,intent: str = "unknown",mode: str = "reply") -> str:
        user_text = (user_text or "").strip()  #handle empty input
        if not user_text:
            return "I didn’t catch that. Can you say it again?" #no API call wasted on empty input

        # Adds message to memory
        self.history.append(("user", user_text))

        # Prefer task_title passed from frontend; fallback to self.current_task
        task_title = (task_title or self.current_task).strip()

        task_hint = (
            f"Current task title: {task_title}\n"
            f"Current task type: {task_action or 'unknown'}\n"
            f"User intent: {intent}\n"
            f"Mode: {mode}"
        )

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
    
    def nudge(self, task_title: str, task_action: str | None = None) -> str:
        return self.respond(
            user_text="(no user message)",
            task_title=task_title,
            task_action=task_action,
            intent="nudge",
            mode="nudge"
        )

'''Things i feel are missing:
- Link to STT feature in STT.py to gather user input to respond to
- Link to TTS to read out AI's response
- How to call out an actual API key(should it be in this file or elsewhere?)
- Missing a connedction to intents.py to classify user input and adjust AI response accordingly

'''