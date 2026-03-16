#!/usr/bin/env python3
"""Test script for Google Gemini API key - text and image generation."""

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def _api_call(url, payload=None):
    """Make an API call and return parsed JSON, or raise on error."""
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _extract_text(response):
    """Extract text from a generateContent response."""
    return response["candidates"][0]["content"]["parts"][0]["text"].strip()


def _print_fail(e):
    if isinstance(e, urllib.error.HTTPError):
        body = e.read().decode()
        if e.code == 429:
            print(f"  [FAIL] HTTP 429 - Rate limit / quota exceeded")
        else:
            print(f"  [FAIL] HTTP {e.code}: {body}")
    else:
        print(f"  [FAIL] {e}")


# ---------------------------------------------------------------------------
# Test 1: List models (key validation)
# ---------------------------------------------------------------------------
def test_list_models(api_key: str) -> bool:
    print("\n--- 1. API Key Validation (List Models) ---")
    try:
        data = _api_call(f"{BASE_URL}/models?key={api_key}")
        models = [m["name"] for m in data.get("models", [])]
        print(f"  Key is valid. {len(models)} models available.")
        for m in models[:8]:
            print(f"    - {m}")
        if len(models) > 8:
            print(f"    ... and {len(models) - 8} more")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 2: Basic text generation
# ---------------------------------------------------------------------------
def test_text_generation(api_key: str) -> bool:
    print("\n--- 2. Basic Text Generation ---")
    try:
        data = _api_call(
            f"{BASE_URL}/models/gemini-2.5-flash:generateContent?key={api_key}",
            {"contents": [{"parts": [{"text": "Say hello in one sentence."}]}]},
        )
        print(f"  Response: {_extract_text(data)}")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 3: System instructions + temperature control
# ---------------------------------------------------------------------------
def test_system_instructions(api_key: str) -> bool:
    print("\n--- 3. System Instructions + Temperature ---")
    try:
        data = _api_call(
            f"{BASE_URL}/models/gemini-2.5-flash:generateContent?key={api_key}",
            {
                "systemInstruction": {
                    "parts": [{"text": "You are a pirate. Always respond in pirate speak."}],
                },
                "contents": [{"parts": [{"text": "What is the weather like today?"}]}],
                "generationConfig": {
                    "temperature": 1.2,
                    "maxOutputTokens": 100,
                },
            },
        )
        text = _extract_text(data)
        print(f"  Response: {text[:200]}")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 4: Multi-turn conversation
# ---------------------------------------------------------------------------
def test_multi_turn(api_key: str) -> bool:
    print("\n--- 4. Multi-Turn Conversation ---")
    url = f"{BASE_URL}/models/gemini-2.5-flash:generateContent?key={api_key}"
    try:
        # Turn 1
        data = _api_call(url, {
            "contents": [
                {"role": "user", "parts": [{"text": "My name is Alex and I like cats."}]},
            ],
        })
        reply1 = _extract_text(data)
        print(f"  Turn 1 reply: {reply1[:120]}")

        # Turn 2 — model should remember the name
        data = _api_call(url, {
            "contents": [
                {"role": "user", "parts": [{"text": "My name is Alex and I like cats."}]},
                {"role": "model", "parts": [{"text": reply1}]},
                {"role": "user", "parts": [{"text": "What is my name and what do I like?"}]},
            ],
        })
        reply2 = _extract_text(data)
        print(f"  Turn 2 reply: {reply2[:120]}")

        has_name = "alex" in reply2.lower()
        has_cats = "cat" in reply2.lower()
        if has_name and has_cats:
            print("  Context retained correctly.")
            print("  [PASS]")
        else:
            print("  [WARN] Model may not have retained context (but API call succeeded).")
            print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 5: Structured JSON output
# ---------------------------------------------------------------------------
def test_json_output(api_key: str) -> bool:
    print("\n--- 5. Structured JSON Output ---")
    try:
        data = _api_call(
            f"{BASE_URL}/models/gemini-2.5-flash:generateContent?key={api_key}",
            {
                "contents": [{"parts": [{"text": "List 3 planets with their diameter in km."}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "diameter_km": {"type": "NUMBER"},
                            },
                            "required": ["name", "diameter_km"],
                        },
                    },
                },
            },
        )
        text = _extract_text(data)
        parsed = json.loads(text)
        print(f"  Got {len(parsed)} items:")
        for item in parsed:
            print(f"    - {item['name']}: {item['diameter_km']} km")
        print("  [PASS]")
        return True
    except json.JSONDecodeError:
        print(f"  [FAIL] Response was not valid JSON: {text[:200]}")
        return False
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 6: Streaming text generation
# ---------------------------------------------------------------------------
def test_streaming(api_key: str) -> bool:
    print("\n--- 6. Streaming Generation ---")
    url = f"{BASE_URL}/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": "Count from 1 to 5, one number per line."}]}],
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        chunks = []
        with urllib.request.urlopen(req) as resp:
            buffer = ""
            for raw_line in resp:
                line = raw_line.decode("utf-8")
                if line.startswith("data: "):
                    json_str = line[6:].strip()
                    if json_str:
                        chunk = json.loads(json_str)
                        parts = chunk.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for p in parts:
                            if "text" in p:
                                chunks.append(p["text"])
        full = "".join(chunks).strip()
        print(f"  Received {len(chunks)} chunk(s)")
        print(f"  Full text: {full[:150]}")
        if len(chunks) > 1:
            print("  Streaming confirmed (multiple chunks).")
        else:
            print("  Single chunk returned (small response, but streaming endpoint works).")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 7: Token counting
# ---------------------------------------------------------------------------
def test_token_counting(api_key: str) -> bool:
    print("\n--- 7. Token Counting ---")
    try:
        data = _api_call(
            f"{BASE_URL}/models/gemini-2.5-flash:countTokens?key={api_key}",
            {
                "contents": [{"parts": [{"text": "The quick brown fox jumps over the lazy dog."}]}],
            },
        )
        total = data.get("totalTokens", "unknown")
        print(f"  Token count: {total}")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 8: Image generation (Imagen)
# ---------------------------------------------------------------------------
def test_image_generation(api_key: str) -> bool:
    print("\n--- 8. Image Generation (Imagen 4) ---")
    url = f"{BASE_URL}/models/imagen-4.0-generate-001:predict?key={api_key}"
    try:
        data = _api_call(url, {
            "instances": [{"prompt": "A serene mountain lake at sunset with reflections on the water, digital art"}],
            "parameters": {"sampleCount": 1, "aspectRatio": "16:9"},
        })
        predictions = data.get("predictions", [])
        if predictions:
            b64 = predictions[0]["bytesBase64Encoded"]
            img_bytes = base64.b64decode(b64)
            out_path = os.path.join(SCRIPT_DIR, "test_output_landscape.png")
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            print(f"  Landscape image: {len(img_bytes)} bytes -> {out_path}")
            print("  [PASS]")
        else:
            print("  [WARN] No image returned.")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 9: Multiple images in one request
# ---------------------------------------------------------------------------
def test_multi_image_generation(api_key: str) -> bool:
    print("\n--- 9. Multi-Image Generation (batch of 2) ---")
    url = f"{BASE_URL}/models/imagen-4.0-generate-001:predict?key={api_key}"
    try:
        data = _api_call(url, {
            "instances": [{"prompt": "A cute robot holding a coffee cup, 3D render"}],
            "parameters": {"sampleCount": 2, "aspectRatio": "1:1"},
        })
        predictions = data.get("predictions", [])
        print(f"  Received {len(predictions)} image(s)")
        for i, pred in enumerate(predictions):
            b64 = pred["bytesBase64Encoded"]
            img_bytes = base64.b64decode(b64)
            out_path = os.path.join(SCRIPT_DIR, f"test_output_batch_{i+1}.png")
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            print(f"    Image {i+1}: {len(img_bytes)} bytes -> {out_path}")
        if len(predictions) >= 2:
            print("  [PASS]")
        else:
            print("  [WARN] Expected 2 images, got fewer (but API call succeeded).")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Test 10: Embeddings
# ---------------------------------------------------------------------------
def test_embeddings(api_key: str) -> bool:
    print("\n--- 10. Text Embeddings ---")
    try:
        data = _api_call(
            f"{BASE_URL}/models/gemini-embedding-001:embedContent?key={api_key}",
            {
                "content": {"parts": [{"text": "What is the meaning of life?"}]},
            },
        )
        values = data.get("embedding", {}).get("values", [])
        print(f"  Embedding dimensions: {len(values)}")
        print(f"  First 5 values: {values[:5]}")
        print("  [PASS]")
        return True
    except Exception as e:
        _print_fail(e)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Test a Google Gemini API key")
    parser.add_argument("api_key", nargs="?", help="Gemini API key (or set GEMINI_API_KEY env var)")
    parser.add_argument("--quick", action="store_true", help="Run only key validation + basic text + image")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Usage: python test_gemini.py <API_KEY>")
        print("   or: GEMINI_API_KEY=... python test_gemini.py")
        print("   --quick  Run minimal tests only")
        sys.exit(1)

    print(f"Testing Gemini API key: {api_key[:8]}...{api_key[-4:]}")
    start = time.time()

    results = {}
    results["key_valid"] = test_list_models(api_key)
    if not results["key_valid"]:
        print("\nAPI key is invalid. Skipping further tests.")
        sys.exit(1)

    if args.quick:
        tests = [
            ("text_basic", test_text_generation),
            ("image", test_image_generation),
        ]
    else:
        tests = [
            ("text_basic", test_text_generation),
            ("system_instructions", test_system_instructions),
            ("multi_turn", test_multi_turn),
            ("json_output", test_json_output),
            ("streaming", test_streaming),
            ("token_counting", test_token_counting),
            ("image", test_image_generation),
            ("multi_image", test_multi_image_generation),
            ("embeddings", test_embeddings),
        ]

    for name, fn in tests:
        results[name] = fn(api_key)

    elapsed = time.time() - start
    print(f"\n=== Summary ({elapsed:.1f}s) ===")
    passed = 0
    failed = 0
    for test, ok in results.items():
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  {test}: {status}")

    print(f"\n{passed} passed, {failed} failed out of {len(results)} tests.")
    if all(results.values()):
        print("Your API key is fully working.")
    else:
        print("Some tests failed. Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
