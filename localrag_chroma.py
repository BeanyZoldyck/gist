import chromadb
import ollama
import os
import argparse
from openai import OpenAI

PINK = "\033[95m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
NEON_GREEN = "\033[92m"
RESET_COLOR = "\033[0m"

CHROMA_DB_PATH = "./chroma_db"


def init_chroma_collection():
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

    try:
        collection = client.get_collection(name="vault")
        print(
            CYAN
            + f"Found existing collection with {collection.count()} documents"
            + RESET_COLOR
        )
    except:
        collection = client.create_collection(
            name="vault", metadata={"hnsw:space": "cosine"}
        )
        print(NEON_GREEN + "Created new collection" + RESET_COLOR)

    return collection


def add_documents_to_vault(filepath, collection):
    with open(filepath, "r", encoding="utf-8") as vault_file:
        content = vault_file.readlines()

    existing_ids = set(collection.get()["ids"])

    documents = []
    ids = []

    for idx, line in enumerate(content):
        doc_id = f"doc_{idx}"
        if doc_id not in existing_ids:
            documents.append(line.strip())
            ids.append(doc_id)

    if documents:
        embeddings = []
        for doc in documents:
            response = ollama.embeddings(model="qwen3-embedding", prompt=doc)
            embeddings.append(response["embedding"])

        collection.add(documents=documents, ids=ids, embeddings=embeddings)
        print(
            NEON_GREEN + f"Added {len(documents)} new documents to vault" + RESET_COLOR
        )
    else:
        print(CYAN + "All documents already in vault" + RESET_COLOR)


def get_relevant_context(rewritten_input, collection, top_k=9):
    input_embedding = ollama.embeddings(
        model="qwen3-embedding", prompt=rewritten_input
    )["embedding"]

    results = collection.query(query_embeddings=[input_embedding], n_results=top_k)

    if results["documents"] and results["documents"][0]:
        return results["documents"][0]
    return []


def ollama_chat(
    user_input, system_message, collection, ollama_model, conversation_history
):
    conversation_history.append({"role": "user", "content": user_input})

    relevant_context = get_relevant_context(user_input, collection)
    if relevant_context:
        context_str = "\n".join(relevant_context)
        print("Context Pulled from Documents: \n\n" + CYAN + context_str + RESET_COLOR)
    else:
        print(CYAN + "No relevant context found." + RESET_COLOR)

    user_input_with_context = user_input
    if relevant_context:
        user_input_with_context = user_input + "\n\nRelevant Context:\n" + context_str

    conversation_history[-1]["content"] = user_input_with_context

    messages = [{"role": "system", "content": system_message}, *conversation_history]

    response = client.chat.completions.create(
        model=ollama_model,
        messages=messages,
        max_tokens=800,
    )

    conversation_history.append(
        {"role": "assistant", "content": response.choices[0].message.content}
    )

    return response.choices[0].message.content


print(NEON_GREEN + "Parsing command-line arguments..." + RESET_COLOR)
parser = argparse.ArgumentParser(description="Ollama Chat with ChromaDB")
parser.add_argument(
    "--model", default="llama3", help="Ollama model to use (default: llama3)"
)
parser.add_argument(
    "--init-vault", action="store_true", help="Initialize vault from vault.txt"
)
args = parser.parse_args()

print(NEON_GREEN + "Initializing ChromaDB..." + RESET_COLOR)
collection = init_chroma_collection()

if args.init_vault and os.path.exists("vault.txt"):
    print(NEON_GREEN + "Initializing vault from vault.txt..." + RESET_COLOR)
    add_documents_to_vault("vault.txt", collection)
elif not args.init_vault:
    print(
        YELLOW
        + "Hint: Use --init-vault flag to load documents from vault.txt"
        + RESET_COLOR
    )

print(NEON_GREEN + "Initializing Ollama API client..." + RESET_COLOR)
client = OpenAI(base_url="http://localhost:11434/v1", api_key="llama3")

print("Starting conversation loop...")
conversation_history = []
system_message = "You are a tweet retrieval assistant. Based on the user's query description, return only the matching tweet content and source. Do not add commentary, analysis, or insights. Simply retrieve and present the relevant tweet(s)."

while True:
    user_input = input(
        YELLOW
        + "Ask a query about your documents (or type 'quit' to exit): "
        + RESET_COLOR
    )
    if user_input.lower() == "quit":
        break

    response = ollama_chat(
        user_input, system_message, collection, args.model, conversation_history
    )
    print(NEON_GREEN + "Response: \n\n" + response + RESET_COLOR)
