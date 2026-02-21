import os
from google import genai

import dotenv

dotenv.load_dotenv()


def generate_embeddings(verbose=False):
    # 1. Initialize the client
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    # 2. Your chunks of data (in a real app, this comes from a chunking function)
    documents = [
        "The open source translation model tweet can be found here: https://twitter.com/tech_update/status/987654321",
        "The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy",
    ]

    # 3. Call the embedding model
    # text-embedding-004 is the recommended model for general text tasks
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=documents,
    )
    vectors = []
    # 4. Extract the vectors to send to Qdrant
    for i, embedding in enumerate(response.embeddings):
        vector = embedding.values
        vectors.append(vector)
        if verbose:
            print(f"\--- Document {i + 1} ---")
            print(f"Original Text: {documents[i]}")
            print(f"Vector Length: {len(vector)} dimensions")
            print(f"Vector Preview: {vector[:5]} ...\n")

        # At this point, you would upload 'vector' to Qdrant.
        # If storing text in Qdrant, you would pass documents[i] as the 'payload'.
    return vectors


if __name__ == "__main__":
    generate_embeddings()
