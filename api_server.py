from fastapi import FastAPI, HTTPException
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
import ollama
from openai import OpenAI
from typing import List, Optional
from google import genai
from rag import query_documents, insert_documents

import dotenv

dotenv.load_dotenv()

CHROMA_DB_PATH = "./chroma_db"
OLLAMA_BASE_URL = "http://localhost:11434/v1"
OLLAMA_MODEL = "llama3"
EMBEDDING_MODEL = "qwen3-embedding"

app = FastAPI(title="Local RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")

chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

try:
    collection = chroma_client.get_collection(name="vault")
except:
    collection = chroma_client.create_collection(
        name="vault", metadata={"hnsw:space": "cosine"}
    )


class QueryRequest(BaseModel):
    query: str
    system_message: Optional[str] = None
    top_k: Optional[int] = 9
    conversation_history: Optional[List[dict]] = None


class AddDocumentRequest(BaseModel):
    content: str
    doc_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    context: List[str]
    sources: List[str]


def generate_embeddings(documents, verbose=False):
    # 1. Initialize the client
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    # 2. Your chunks of data (in a real app, this comes from a chunking function)
    # documents = [
    #     "The open source translation model tweet can be found here: https://twitter.com/tech_update/status/987654321",
    #     "The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy",
    # ]

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


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Local RAG API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "vault_size": collection.count()}


@app.post("/query", response_model=ChatResponse)
def query_rag(request: QueryRequest):
    try:
        input_embedding = ollama.embeddings(
            model=EMBEDDING_MODEL, prompt=request.query
        )["embedding"]

        results = collection.query(
            query_embeddings=[input_embedding], n_results=request.top_k
        )

        context = []
        sources = []
        if results["documents"] and results["documents"][0]:
            context = results["documents"][0]
            sources = results["ids"][0] if results["ids"] else []

        user_input_with_context = request.query
        if context:
            user_input_with_context = (
                request.query + "\n\nRelevant Context:\n" + "\n".join(context)
            )

        system_message = (
            request.system_message
            or "You are a helpful assistant that answers questions based on the provided context."
        )

        messages = [{"role": "system", "content": system_message}]

        if request.conversation_history:
            messages.extend(request.conversation_history)

        messages.append({"role": "user", "content": user_input_with_context})

        response = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=messages,
            max_tokens=800,
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            context=context,
            sources=sources,
        )
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents")
def add_document(request: AddDocumentRequest):
    try:
        doc_id = request.doc_id or f"doc_{collection.count()}"

        existing = collection.get(ids=[doc_id])
        if existing["ids"]:
            collection.update(
                ids=[doc_id],
                documents=[request.content],
                embeddings=[
                    ollama.embeddings(model=EMBEDDING_MODEL, prompt=request.content)[
                        "embedding"
                    ]
                ],
            )
            return {"message": "Document updated", "doc_id": doc_id}
        else:
            collection.add(
                ids=[doc_id],
                documents=[request.content],
                embeddings=[
                    ollama.embeddings(model=EMBEDDING_MODEL, prompt=request.content)[
                        "embedding"
                    ]
                ],
            )
            return {"message": "Document added", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents")
def list_documents():
    try:
        results = collection.get()
        return {
            "documents": results["documents"],
            "ids": results["ids"],
            "count": len(results["ids"]) if results["ids"] else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    try:
        collection.delete(ids=[doc_id])
        return {"message": "Document deleted", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vault/init")
def init_vault_from_file(filepath: str = "vault.txt"):
    try:
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail=f"File {filepath} not found")

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
                response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=doc)
                embeddings.append(response["embedding"])

            collection.add(documents=documents, ids=ids, embeddings=embeddings)
            return {
                "message": f"Added {len(documents)} documents to vault",
                "added_count": len(documents),
            }
        else:
            return {"message": "All documents already in vault", "added_count": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/vault/clear")
def clear_vault():
    try:
        chroma_client.delete_collection(name="vault")
        global collection
        collection = chroma_client.create_collection(
            name="vault", metadata={"hnsw:space": "cosine"}
        )
        return {"message": "Vault cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
