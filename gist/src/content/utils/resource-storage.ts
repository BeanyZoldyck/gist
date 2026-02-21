import { upsertResource as qdrantUpsert, searchResources as qdrantSearch, deleteResource as qdrantDelete, getAllResources as qdrantGetAll } from '@/utils/qdrant-client'

export interface Resource {
  id: string
  url: string
  title: string
  text?: string
  notes: string
  tags: string[]
  createdAt: number
  updatedAt?: number
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    
    const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    })
    
    const output = await model(text, {
      pooling: 'mean',
      normalize: true
    })
    
    return Array.from(output.data)
  } catch (error) {
    console.error('[Embeddings] Failed to generate embedding:', error)
    return null
  }
}

async function getEmbeddingText(resource: Omit<Resource, 'id' | 'createdAt'>): Promise<string> {
  const parts = [
    resource.title,
    resource.url,
    resource.notes,
    resource.tags.join(' '),
    resource.text || ''
  ]
  return parts.filter(Boolean).join(' ')
}

export async function getAllResources(): Promise<Resource[]> {
  try {
    const points = await qdrantGetAll()
    return points.map(p => ({
      id: p.id,
      url: p.payload.url,
      title: p.payload.title,
      text: p.payload.text,
      notes: p.payload.notes,
      tags: p.payload.tags,
      createdAt: p.payload.createdAt,
      updatedAt: p.payload.updatedAt
    }))
  } catch (error) {
    console.error('[Storage] Failed to get resources:', error)
    return []
  }
}

export async function getResource(id: string): Promise<Resource | null> {
  const resources = await getAllResources()
  return resources.find(r => r.id === id) || null
}

export async function saveResource(resource: Omit<Resource, 'id' | 'createdAt'> & { id?: string }): Promise<Resource> {
  const now = Date.now()
  
  const newResource: Resource = {
    ...resource,
    id: resource.id || `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: resource.id ? (await getAllResources()).find(r => r.id === resource.id)?.createdAt || now : now,
    updatedAt: now
  }
  
  const embeddingText = await getEmbeddingText(newResource)
  const embedding = await generateEmbedding(embeddingText)
  
  if (!embedding) {
    console.error('[Storage] Failed to generate embedding for resource')
    throw new Error('Failed to generate embedding')
  }
  
  await qdrantUpsert({
    id: newResource.id,
    vector: embedding,
    payload: {
      url: newResource.url,
      title: newResource.title,
      text: newResource.text,
      notes: newResource.notes,
      tags: newResource.tags,
      createdAt: newResource.createdAt,
      updatedAt: newResource.updatedAt
    }
  })
  
  return newResource
}

export async function deleteResource(id: string): Promise<void> {
  await qdrantDelete(id)
}

export async function updateResourceTags(id: string, tags: string[]): Promise<Resource | null> {
  const resource = await getResource(id)
  if (!resource) return null
  
  resource.tags = tags
  resource.updatedAt = Date.now()
  await saveResource(resource)
  return resource
}

export async function updateResourceNotes(id: string, notes: string): Promise<Resource | null> {
  const resource = await getResource(id)
  if (!resource) return null
  
  resource.notes = notes
  resource.updatedAt = Date.now()
  await saveResource(resource)
  return resource
}

export async function searchResources(query: string): Promise<Resource[]> {
  if (!query.trim()) {
    return getAllResources()
  }
  
  try {
    const results = await qdrantSearch(query, 50)
    return results.map(r => ({
      id: r.id,
      url: r.payload.url,
      title: r.payload.title,
      text: r.payload.text,
      notes: r.payload.notes,
      tags: r.payload.tags,
      createdAt: r.payload.createdAt,
      updatedAt: r.payload.updatedAt
    }))
  } catch (error) {
    console.error('[Storage] Search failed, returning empty:', error)
    return []
  }
}

export function getResourcePreviewText(resource: Resource): string {
  const maxLength = 100
  if (resource.notes && resource.notes.length > 0) {
    return resource.notes.length > maxLength ? resource.notes.substring(0, maxLength) + '...' : resource.notes
  }
  if (resource.text && resource.text.length > 0) {
    return resource.text.length > maxLength ? resource.text.substring(0, maxLength) + '...' : resource.text
  }
  return resource.url
}

export function formatResourceDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString()
}
