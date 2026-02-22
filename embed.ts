import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables from a .env file
dotenv.config();

export async function generateEmbeddings(verbose: boolean = false): Promise<number[][]> {
    // 1. Initialize the client
    // The SDK automatically picks up the GEMINI_API_KEY environment variable.
    const ai = new GoogleGenAI({});

    // 2. Your chunks of data (in a real app, this comes from a chunking function)
    const documents: string[] = [
        "The open source translation model tweet can be found here: https://twitter.com/tech_update/status/987654321",
        "The new deployment guide for the frontend is located at https://internal.wiki.com/frontend-deploy",
    ];

    // 3. Call the embedding model
    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: documents,
    });

    const vectors: number[][] = [];

    // 4. Extract the vectors to send to Qdrant
    if (response.embeddings) {
        response.embeddings.forEach((embedding, i) => {
            // Provide a fallback empty array in case values are undefined
            const vector = embedding.values || [];
            vectors.push(vector);

            if (verbose) {
                console.log(`\\--- Document ${i + 1} ---`);
                console.log(`Original Text: ${documents[i]}`);
                console.log(`Vector Length: ${vector.length} dimensions`);
                console.log(`Vector Preview: [${vector.slice(0, 5).join(', ')}] ...\n`);
            }
        });
    }

    // At this point, you would upload 'vectors' to Qdrant.
    // If storing text in Qdrant, you would pass documents[i] as the 'payload'.
    return vectors;
}

// Execute the function if this script is run directly
if (require.main === module) {
    generateEmbeddings(true).catch((error) => {
        console.error("Error generating embeddings:", error);
    });
}
