from google import genai
import os

os.environ["GEMINI_API_KEY"] = "AIzaSyCUIHkk6L6MNL0O9jljOJ7aYKkQl8j91Lg"

client = genai.Client()

# Generate a response using Gemini 2.5 Flash-Lite
response = client.models.generate_content(
    model="models/gemini-2.5-flash-lite",
    contents="Explain how transformers work in AI, in simple terms.",
)

# Print the response text
print(response.text)
