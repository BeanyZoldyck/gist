import os
import uuid
from dotenv import load_dotenv
from google import genai
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()


qdrant = QdrantClient(host="127.0.0.1", port=6333, check_compatibility=False)

COLLECTION_NAME = "my_knowledge_base"
VECTOR_SIZE = 768


def insert_documents(documents: list[str]) -> None:
    if not documents:
        return

    collections = qdrant.get_collections()
    exists = any(c.name == COLLECTION_NAME for c in collections.collections)

    if not exists:
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"Created new Qdrant collection: {COLLECTION_NAME}")

    print(f"Generating embeddings for {len(documents)} documents...")
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    embed_response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=documents,
    )

    if embed_response.embeddings:
        points = []
        for i, embedding in enumerate(embed_response.embeddings):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={"text": documents[i]},
                )
            )

        qdrant.upsert(collection_name=COLLECTION_NAME, wait=True, points=points)

        print(f"✅ Successfully inserted {len(points)} documents into Qdrant.")


def query_documents(query: str, limit: int = 1) -> list[str]:
    print(f'\nEmbedding search query: "{query}"')

    embed_model = ai.models.get_model("models/embedding-001")
    query_embed_response = embed_model.embed_content(
        content=query, task_type="RETRIEVAL_QUERY", output_dimensionality=VECTOR_SIZE
    )

    query_vector = query_embed_response.embedding.values

    if not query_vector:
        raise RuntimeError("Failed to generate embedding for the query.")

    print(f"Searching Qdrant for the top {limit} semantic match(es)...")
    search_results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=limit,
        with_payload=True,
    )

    results = []
    for match in search_results:
        print(f"🎯 Match Score: {match.score}")
        results.append(match.payload["text"])

    return results


if __name__ == "__main__":
    sample_data = [
        "The open source translation model tweet can be found here: https://twitter.com/tech_update/status/987654321",
        "The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy",
        "To reset your corporate password, please contact IT support at ext. 5555.",
    ]

    insert_documents(sample_data)

    question = "How do I push the frontend code to production?"
    results = query_documents(question, 1)

    print(f"\nRetrieved Text: {results[0]}")
