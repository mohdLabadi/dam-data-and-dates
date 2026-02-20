 # GenAI Social Match Maker (Flask + Ollama)
 
 This mini web app demonstrates how to:
 
 - Collect free‑text preferences about the kind of **social relationship** a user is seeking.
 - Ask a **local Ollama model** to generate three fictional profiles that resemble an ideal match.
 - Let the user **pick one profile and iteratively refine it** with additional feedback.
 
 The app is self‑contained and runs entirely on your machine as long as Ollama is running.
 
 ## 1. Prerequisites
 
 - Python 3.10+ recommended
 - [Ollama](https://ollama.com) installed and running locally:
   - Start the server: `ollama serve`
   - Pull the example model: `ollama pull smollm2:1.7b`
 
 Optionally set overrides in your project‑root `.env`:
 
 ```bash
 OLLAMA_PORT=11434
 OLLAMA_HOST=http://localhost:11434
 OLLAMA_MODEL=smollm2:1.7b
 FLASK_PORT=5000
 FLASK_DEBUG=1
 ```
 
 If the variables are not set, the defaults above are used.
 
 ## 2. Install Python dependencies
 
 From the project root (same level as `03_query_ai`), run:
 
 ```bash
 cd datingai
 pip install -r requirements.txt
 ```
 
 This installs:
 
 - `flask` – to serve the web app and API.
 - `requests` – to call the Ollama HTTP API.
 - `python-dotenv` – to read configuration from a `.env` file.
 
 ## 3. Run the app
 
 Make sure Ollama is running, then start the Flask server:
 
 ```bash
 cd datingai
 python app.py
 ```
 
 By default, the app listens on `http://127.0.0.1:5000`. Open this URL in your browser.
 
 ## 4. How the flow works
 
 1. The user selects a **relationship type** (romantic partner, close friend, mentor, etc.).
 2. The user describes what they are looking for (traits, values, interests, boundaries).
 3. The backend builds a **structured prompt** and sends it to a local Ollama model.
 4. The model returns **JSON with three fictional profiles**.
 5. The browser displays each profile as a **card**, with:
    - Name, age, and location.
    - Personality, interests, goals, backstory, and why it might fit.
 6. The user chooses one card and adds extra guidance (e.g., “slightly older and more outdoorsy”).
 7. The backend sends the original profile plus the new feedback back to Ollama.
 8. The model returns a **refined version** of that profile, which replaces the original on screen.
 
 This pattern—**collect inputs → call LLM → show options → refine with feedback**—is a common
 blueprint for GenAI‑powered UX in many domains beyond social relationships.
 
