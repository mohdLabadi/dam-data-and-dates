# app.py
# GenAI Social Match Web App
# Pairs with 03_query_ai/02_ollama.py
# Tim Fraser
#
# This script implements a small Flask web app that talks to a local
# Ollama LLM. Students will learn how to wrap a language model behind
# a simple API and build an interactive UI that refines model outputs
# based on user feedback.

# 0. Setup #################################

## 0.1 Load Packages ############################

import json
import os
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request


## 0.2 Configuration ############################

# Load environment variables from .env in the project root (if present)
load_dotenv(".env")

OLLAMA_PORT = int(os.getenv("OLLAMA_PORT", "11434"))
OLLAMA_HOST = os.getenv("OLLAMA_HOST", f"http://localhost:{OLLAMA_PORT}")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "smollm2:1.7b")


# 1. Ollama helpers #################################

def check_ollama_running() -> bool:
    """Return True if a local Ollama server responds."""
    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def ollama_generate(prompt: str, model: str) -> str:
    """Send a prompt to Ollama and return the model's text response."""
    url = f"{OLLAMA_HOST}/api/generate"
    body = {"model": model, "prompt": prompt, "stream": False}
    response = requests.post(url, json=body, timeout=120)
    response.raise_for_status()
    data = response.json()
    return data.get("response", "")


# 2. Prompt builders #################################

def build_profiles_prompt(relationship_type: str, preferences: str) -> str:
    """Prompt the model to generate exactly 3 structured fictional profiles."""
    return f"""
You are helping a user imagine a fictional {relationship_type} relationship.

Read the user's preferences and then create exactly 3 distinct fictional people
who could be a good match. Return ONLY valid JSON (no markdown, no backticks,
no commentary). The JSON must use this exact shape:

{{
"profiles": [
    {{
    "id": 1,
    "name": "First Last",
    "age": 28,
    "location": "City, Country",
    "relationship_type": "{relationship_type}",
    "personality": "2–4 sentences that summarize their personality.",
    "interests": ["short phrase 1", "short phrase 2", "short phrase 3"],
    "relationship_goals": "2–3 sentences describing what they are looking for.",
    "backstory": "2–4 sentences of fictional history that fits the user.",
    "why_a_good_match": "1–3 sentences that reference specific user preferences."
    }},
    {{
    "id": 2,
    "name": "...",
    "age": 30,
    "location": "...",
    "relationship_type": "{relationship_type}",
    "personality": "...",
    "interests": ["...", "..."],
    "relationship_goals": "...",
    "backstory": "...",
    "why_a_good_match": "..."
    }},
    {{
    "id": 3,
    "name": "...",
    "age": 35,
    "location": "...",
    "relationship_type": "{relationship_type}",
    "personality": "...",
    "interests": ["...", "..."],
    "relationship_goals": "...",
    "backstory": "...",
    "why_a_good_match": "..."
    }}
]
}}

User preferences (quote these explicitly in the matches):
{preferences}
""".strip()


def build_refine_prompt(selected_profile: Dict[str, Any], extra_input: str) -> str:
    """Prompt the model to refine a single profile based on extra feedback."""
    profile_json = json.dumps(selected_profile, indent=2)
    return f"""
You are refining a fictional profile so it better matches what the user wants.

The profile you are starting from is:
{profile_json}

The user has provided additional guidance and preferences. Carefully read this
feedback and adjust the profile so it fits even better, while keeping it
believable and consistent:

USER FEEDBACK:
{extra_input}

Return ONLY valid JSON with a single key "profile" and a value that has the
same structure as the original object. Example:

{{
"profile": {{
    "id": 1,
    "name": "Updated Name",
    "age": 29,
    "location": "...",
    "relationship_type": "...",
    "personality": "...",
    "interests": ["...", "..."],
    "relationship_goals": "...",
    "backstory": "...",
    "why_a_good_match": "..."
}}
}}
""".strip()


# 3. Flask app #################################

app = Flask(__name__, template_folder="templates", static_folder="static")


@app.route("/", methods=["GET"])
def index():
    """Render the main HTML page."""
    return render_template("index.html")


@app.post("/api/profiles")
def api_profiles():
    """Generate three fictional profiles based on user inputs."""
    if not check_ollama_running():
        return jsonify(
            {
                "error": "Ollama is not reachable. "
                        "Start it with 'ollama serve' and pull the model "
                        f"'{OLLAMA_MODEL}' if needed."
            }
        ), 503

    payload = request.get_json(silent=True) or {}
    relationship_type = payload.get("relationship_type", "romantic partner")
    preferences = (payload.get("preferences") or "").strip()

    if not preferences:
        return jsonify({"error": "Please describe what you are looking for first."}), 400

    prompt = build_profiles_prompt(relationship_type=relationship_type, preferences=preferences)
    raw_text = ollama_generate(prompt, model=OLLAMA_MODEL)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        # If the model does not return valid JSON, surface the raw text for debugging.
        return jsonify(
            {
                "error": "The model did not return valid JSON. "
                        "Try simplifying your instructions or prompt.",
                "raw_response": raw_text,
            }
        ), 500

    profiles: List[Dict[str, Any]] = data.get("profiles") or []
    if not isinstance(profiles, list) or len(profiles) == 0:
        return jsonify(
            {
                "error": "No profiles were returned by the model.",
                "raw_response": raw_text,
            }
        ), 500

    return jsonify({"profiles": profiles})


@app.post("/api/refine")
def api_refine():
    """Refine a selected profile based on additional user feedback."""
    if not check_ollama_running():
        return jsonify(
            {
                "error": "Ollama is not reachable. "
                        "Start it with 'ollama serve' and pull the model "
                        f"'{OLLAMA_MODEL}' if needed."
            }
        ), 503

    payload = request.get_json(silent=True) or {}
    selected_profile = payload.get("profile")
    extra_input = (payload.get("extra_input") or "").strip()

    if not isinstance(selected_profile, dict):
        return jsonify({"error": "A valid profile object is required for refinement."}), 400

    if not extra_input:
        return jsonify({"error": "Please provide a bit of feedback to refine the profile."}), 400

    prompt = build_refine_prompt(selected_profile=selected_profile, extra_input=extra_input)
    raw_text = ollama_generate(prompt, model=OLLAMA_MODEL)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        return jsonify(
            {
                "error": "The model did not return valid JSON while refining.",
                "raw_response": raw_text,
            }
        ), 500

    refined_profile = data.get("profile") or selected_profile
    if not isinstance(refined_profile, dict):
        refined_profile = selected_profile

    return jsonify({"profile": refined_profile})


if __name__ == "__main__":
    # Run the app locally for development.
    debug_flag = os.getenv("FLASK_DEBUG", "1") == "1"
    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"\n🚀 Starting GenAI Match Web App on http://127.0.0.1:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=debug_flag)

