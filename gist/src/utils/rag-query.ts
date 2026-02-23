import { searchResources } from './qdrant-client'

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

  let searchResults: any[] = []
  try {
    searchResults = await searchResources(question, maxSources)
  } catch (error) {
    console.log('[RAG] Search failed, using keyword fallback:', error)
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
