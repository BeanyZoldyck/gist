import os
import dotenv
import sys
from google import genai
from google.genai import types


def main():
    # 1. Setup your API key
    # Ensure you have run: export GEMINI_API_KEY="your_actual_key_here"
    dotenv.load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: Please set the GEMINI_API_KEY environment variable.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # 2. Your Context Data
    # In a real app, you might do: user_data = open("my_data.txt").read()
    user_data = """
    - [2026-01-10] The open source google translate tweet can be found https://x.com/itspaulai/status/2011855062457634902?s=12
    - [2026-02-18] The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy
    - [2026-02-20] Project X launch was delayed due to the new authentication bug.
    """

    # 3. Configure the System Instruction
    # This acts as the absolute truth for the model's behavior and knowledge base.
    config = types.GenerateContentConfig(
        system_instruction=(
            "You are a highly accurate data-retrieval assistant. "
            "Answer the user's questions based ONLY on the following provided data. "
            "If the answer is not in the data, simply say 'I don't have that information.'\n\n"
            f"DATA:\n{user_data}"
        ),
        temperature=0.0,  # Kept at 0.0 for factual, non-creative retrieval
    )

    # 4. Initialize the Chat Session
    # Using Flash as it is exceptionally fast and cost-effective for CLI interactions
    try:
        chat = client.chats.create(model="gemini-2.5-flash", config=config)
    except Exception as e:
        print(f"Failed to start chat session: {e}")
        sys.exit(1)

    print("🤖 Gemini 'RAG-lite' CLI initialized. Type 'exit' or 'quit' to stop.")
    print("-" * 60)

    # 5. The CLI Interaction Loop
    while True:
        try:
            user_input = input("\nYou: ")

            # Handle exit commands
            if user_input.strip().lower() in ["quit", "exit"]:
                print("Goodbye!")
                break

            # Skip empty inputs
            if not user_input.strip():
                continue

            # Send the message to Gemini and get the response
            response = chat.send_message(user_input)
            print(f"Gemini: {response.text}")

        except KeyboardInterrupt:
            # Handle Ctrl+C gracefully
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    main()
