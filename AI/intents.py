# AI/intents.py
# This file stores "intent rules" (keywords → intent name)
# Keeping it separate makes it easy to tweak behavior without touching main logic.

INTENT_KEYWORDS = {
    "greeting": ["hi", "hello", "hey"],
    "tired": ["sleepy", "tired", "exhausted"],
    "stressed": ["stressed", "anxious", "overwhelmed"],
    "confused": ["i don't know", "dont know", "confused", "not sure", "huh"],
    "task_help": ["what next", "next task", "what do i do", "help me"],
    "resistance": ["don't want", "dont want", "no", "later", "not now"],
    "reassurance": ["is this okay", "am i doing right", "is it correct"],
    "done": ["done", "finished", "completed", "i did it"],
    "distress": ["i don't like this", "uncomfortable", "scared", "upset"],
    "goodbye": ["bye", "goodbye", "see you", "quit", "stop"]
}