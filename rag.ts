import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// 1. Initialize global clients and constants
const ai = new GoogleGenAI({});
const qdrant = new QdrantClient({ host: 'localhost', port: 6333 });

const COLLECTION_NAME = "my_knowledge_base";
const VECTOR_SIZE = 768; // Must match Gemini's output configuration

/**
 * Generates embeddings for an array of text documents and saves them to Qdrant.
 */
export async function insertDocuments(documents: string[]): Promise<void> {
    if (documents.length === 0) return;

    // Check if collection exists, create if it doesn't
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    
    if (!exists) {
        await qdrant.createCollection(COLLECTION_NAME, {
            vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
        });
        console.log(`Created new Qdrant collection: ${COLLECTION_NAME}`);
    }

    console.log(`Generating embeddings for ${documents.length} documents...`);
    const embedResponse = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: documents,
        config: {
            outputDimensionality: VECTOR_SIZE,
            taskType: "RETRIEVAL_DOCUMENT" // Optimized for database storage
        }
    });

    if (embedResponse.embeddings) {
        const points = embedResponse.embeddings.map((embedding, i) => ({
            id: uuidv4(), // Safely generate a unique ID for every document
            vector: embedding.values || [],
            payload: { text: documents[i] } // Store the raw string in the payload
        }));

        await qdrant.upsert(COLLECTION_NAME, {
            wait: true, // Block until Qdrant confirms the write
            points: points
        });
        
        console.log(`✅ Successfully inserted ${points.length} documents into Qdrant.`);
    }
}

/**
 * Embeds a user's query and retrieves the most semantically similar documents.
 */
export async function queryDocuments(query: string, limit: number = 1): Promise<string[]> {
    console.log(`\nEmbedding search query: "${query}"`);
    
    const queryEmbedResponse = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: query,
        config: {
            outputDimensionality: VECTOR_SIZE,
            taskType: "RETRIEVAL_QUERY" // Optimized for searching against stored docs
        }
    });

    const queryVector = queryEmbedResponse.embeddings?.[0]?.values;
    
    if (!queryVector) {
        throw new Error("Failed to generate embedding for the query.");
    }

    console.log(`Searching Qdrant for the top ${limit} semantic match(es)...`);
    const searchResults = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: limit,
        with_payload: true // Tell Qdrant to hand back the original text
    });

    // Extract the text strings from the Qdrant payload and print the confidence scores
    return searchResults.map(match => {
        console.log(`🎯 Match Score: ${match.score}`);
        return match.payload?.text as string;
    });
}

// --- Quick Test Execution ---
if (require.main === module) {
    async function runTest() {
        const sampleData = [
            "The open source translation model tweet can be found here: https://twitter.com/tech_update/status/987654321",
            "The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy",
            "To reset your corporate password, please contact IT support at ext. 5555."
        ];

        // 1. Insert the data
        await insertDocuments(sampleData);

        // 2. Query the data
        const question = "How do I push the frontend code to production?";
        const results = await queryDocuments(question, 1);
        
        console.log(`\nRetrieved Text: ${results[0]}`);
    }

    runTest().catch(console.error);
}unRAGPipeline().catch(console.error);
