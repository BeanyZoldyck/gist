from fastapi import FastAPI, HTTPException
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from rag import query_documents, insert_documents, chat_completion

import dotenv

dotenv.load_dotenv()

app = FastAPI(title="Local RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Local RAG API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/query", response_model=ChatResponse)
def query_rag(request: QueryRequest):
    try:
        context = query_documents(request.query, limit=request.top_k or 9)

        system_message = (
            request.system_message
            or "You are a helpful assistant that answers questions based on the provided context."
        )

        response = chat_completion(
            query=request.query,
            context=context,
            system_message=system_message,
            conversation_history=request.conversation_history,
        )

        return ChatResponse(
            response=response,
            context=context,
        )
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents")
def add_document(request: AddDocumentRequest):
    try:
        insert_documents([request.content])
        print(f"inserted {request.content}")
        return {"message": "Document added"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vault/init")
def init_vault_from_file(filepath: str = "vault.txt"):
    try:
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail=f"File {filepath} not found")

        with open(filepath, "r", encoding="utf-8") as vault_file:
            content = vault_file.readlines()

        documents = [line.strip() for line in content if line.strip()]

        if documents:
            insert_documents(documents)
            return {
                "message": f"Added {len(documents)} documents to vault",
                "added_count": len(documents),
            }
        else:
            return {"message": "No documents to add", "added_count": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
