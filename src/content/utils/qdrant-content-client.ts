const COLLECTION_NAME = 'gist_resources'

interface QdrantConfig {
  apiKey: string
  endpoint: string
}

interface QdrantPoint {
  id: string
  vector: number[]
  payload: {
    url: string
    title: string
    text?: string
    notes: string
    tags: string[]
    createdAt: number
    updatedAt?: number
  }
}

export interface QdrantSearchResult {
  id: string
  score: number
  payload: QdrantPoint['payload']
}

async function getConfig(): Promise<QdrantConfig | null> {
  const result = await chrome.storage.local.get(['qdrant_api_key', 'qdrant_endpoint']) as { qdrant_api_key?: string; qdrant_endpoint?: string }
  if (!result.qdrant_api_key || !result.qdrant_endpoint) {
    return null
  }
  return {
    apiKey: result.qdrant_api_key,
    endpoint: result.qdrant_endpoint
  }
}

async function qdrantRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const config = await getConfig()
  if (!config) {
    throw new Error('Qdrant not configured')
  }

  const url = `${config.endpoint}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    'api-key': config.apiKey,
    ...options.headers
  }

  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Qdrant error: ${error.message || response.statusText}`)
  }
  return response.json()
}

export async function ensureCollection(): Promise<void> {
  try {
    await qdrantRequest(`/collections/${COLLECTION_NAME}`)
  } catch (error) {
    if ((error as Error).message?.includes('404')) {
      await qdrantRequest(`/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        body: JSON.stringify({
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        })
      })
    } else {
      throw error
    }
  }
}

export async function searchResources(query: string, limit: number = 3): Promise<QdrantSearchResult[]> {
  const embedding = await generateLocalEmbedding(query)
  if (!embedding) {
    throw new Error('Failed to generate embedding')
  }

  const result = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/search`, {
    method: 'POST',
    body: JSON.stringify({
      vector: embedding,
      limit,
      with_payload: true
    })
  })

  return result.result || []
}

let embeddingModel: any = null

async function generateLocalEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!embeddingModel) {
      const { pipeline, env } = await import('@xenova/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = true

      embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true
      })
    }

    const output = await embeddingModel(text, {
      pooling: 'mean',
      normalize: true
    })

    return Array.from(output.data)
  } catch (error) {
    console.error('[Embeddings] Failed to generate local embedding:', error)
    return null
  }
}
