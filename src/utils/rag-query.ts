import { searchResources } from './qdrant-client'

const DB_NAME = 'gist-resources'
const DB_VERSION = 2
const STORE_NAME = 'resources'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAllResourcesFromDB(): Promise<any[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('[RAG] DB open error:', e)
    return []
  }
}

async function searchFromIndexedDB(query: string, limit: number = 5): Promise<any[]> {
  const allResources = await getAllResourcesFromDB()
  console.log('[RAG] Total resources in DB:', allResources.length)
  
  if (!query || allResources.length === 0) {
    return allResources.slice(0, limit).map((r: any) => ({
      payload: { url: r.url, title: r.title, notes: r.notes || '', text: r.text || '' },
      score: 0.5
    }))
  }
  
  const lowerQuery = query.toLowerCase()
  const scored = allResources.map((r: any) => {
    let score = 0
    if (r.title?.toLowerCase().includes(lowerQuery)) score += 3
    if (r.url?.toLowerCase().includes(lowerQuery)) score += 2
    if (r.notes?.toLowerCase().includes(lowerQuery)) score += 2
    if (r.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))) score += 2
    if (r.text?.toLowerCase().includes(lowerQuery)) score += 1
    return { resource: r, score }
  })
  
  scored.sort((a, b) => b.score - a.score)
  
  const filtered = scored.filter(s => s.score > 0)
  console.log('[RAG] Matched resources:', filtered.length)
  
  return filtered.slice(0, limit).map((s: any) => ({
    payload: { url: s.resource.url, title: s.resource.title, notes: s.resource.notes || '', text: s.resource.text || '' },
    score: s.score / 10
  }))
}

export interface RAGConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface Source {
  url: string
  title: string
  snippet: string
  score: number
}

export interface RAGResponse {
  answer: string
  sources: Source[]
}

export async function getAIConfig(): Promise<RAGConfig | null> {
  const result = await chrome.storage.local.get(['aiApiKey', 'aiModel', 'aiBaseUrl']) as {
    aiApiKey?: string
    aiModel?: string
    aiBaseUrl?: string
  }
  
  if (!result.aiApiKey || !result.aiBaseUrl) {
    return null
  }
  
  return {
    apiKey: result.aiApiKey,
    baseUrl: result.aiBaseUrl,
    model: result.aiModel || 'openai/gpt-4o'
  }
}

export async function queryWithLLM(question: string, maxSources: number = 5): Promise<RAGResponse> {
  const config = await getAIConfig()
  
  if (!config) {
    throw new Error('AI not configured. Please set up AI in extension settings.')
  }

  console.log('[RAG] Starting search for:', question)

  let searchResults: any[] = []
  
  // Try IndexedDB first (more reliable) - get all resources and filter locally
  try {
    console.log('[RAG] Trying IndexedDB search...')
    searchResults = await searchFromIndexedDB(question, maxSources * 2)
    console.log('[RAG] IndexedDB returned:', searchResults.length, 'results')
  } catch (error) {
    console.log('[RAG] IndexedDB fallback also failed:', error)
  }

  // Try Qdrant as secondary
  if (searchResults.length === 0) {
    try {
      console.log('[RAG] Trying Qdrant search...')
      searchResults = await searchResources(question, maxSources)
      console.log('[RAG] Qdrant returned:', searchResults.length, 'results')
    } catch (error) {
      console.log('[RAG] Qdrant search failed:', error)
    }
  }

  const sources: Source[] = searchResults.map((result: any) => ({
    url: result.payload?.url || '',
    title: result.payload?.title || result.title || '',
    snippet: result.payload?.notes || result.payload?.text || '',
    score: result.score || 0
  }))

  if (sources.length === 0) {
    return {
      answer: "I couldn't find any relevant saved links to answer your question. Try saving some links first!",
      sources: []
    }
  }

  const context = sources
    .map((s, i) => `[Source ${i + 1}]: ${s.title}\nURL: ${s.url}\nContent: ${s.snippet}`)
    .join('\n\n')

  const systemPrompt = `You are a helpful assistant that answers questions based on the user's saved links/notes. 

Answer the user's question using ONLY the provided sources. If the sources don't contain enough information to answer the question, say so clearly.

For each answer:
1. Use the information from the sources to provide a accurate response
2. Reference the source titles when relevant
3. Be concise but informative

Sources:
${context}

Question: ${question}

Answer:`

  const answer = await callLLM(config, systemPrompt)

  return {
    answer,
    sources
  }
}

async function callLLM(config: RAGConfig, prompt: string): Promise<string> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'No response generated'
  } catch (error) {
    console.error('[RAG] LLM call failed:', error)
    throw error
  }
}
