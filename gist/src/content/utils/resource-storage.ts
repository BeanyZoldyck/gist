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

const STORAGE_KEY = 'gist_resources'

async function getAllFromStorage(): Promise<Resource[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY], (result: { [key: string]: any }) => {
      if (chrome.runtime.lastError) {
        console.error('[Storage] Failed to get resources:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        resolve((result[STORAGE_KEY] as Resource[]) || [])
      }
    })
  })
}

export async function getAllResources(): Promise<Resource[]> {
  try {
    return await getAllFromStorage()
  } catch (error) {
    console.error('[Storage] Failed to get resources:', error)
    return []
  }
}

export async function getResource(id: string): Promise<Resource | null> {
  try {
    const allResources = await getAllFromStorage()
    return allResources.find(r => r.id === id) || null
  } catch (error) {
    console.error('[Storage] Failed to get resource:', error)
    return null
  }
}

export async function saveResource(resource: Omit<Resource, 'id' | 'createdAt'> & { id?: string }): Promise<Resource> {
  const now = Date.now()
  const existingResources = await getAllFromStorage()
  
  const existingResource = resource.id ? existingResources.find(r => r.id === resource.id) : null
  
  const newResource: Resource = {
    ...resource,
    id: resource.id || `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: existingResource?.createdAt || now,
    updatedAt: now
  }
  
  const existingIndex = existingResources.findIndex(r => r.id === newResource.id)
  if (existingIndex >= 0) {
    existingResources[existingIndex] = newResource
  } else {
    existingResources.push(newResource)
  }
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: existingResources }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Storage] Failed to save resource:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.log('[Storage] Saved resource:', newResource.id)
        resolve(newResource)
      }
    })
  })
}

export async function deleteResource(id: string): Promise<void> {
  const existingResources = await getAllFromStorage()
  const filtered = existingResources.filter(r => r.id !== id)
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Storage] Failed to delete resource:', chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.log('[Storage] Deleted resource:', id)
        resolve()
      }
    })
  })
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
    const allResources = await getAllFromStorage()
    const lowerQuery = query.toLowerCase()
    
    return allResources.filter(resource => {
      const titleMatch = resource.title.toLowerCase().includes(lowerQuery)
      const urlMatch = resource.url.toLowerCase().includes(lowerQuery)
      const notesMatch = resource.notes.toLowerCase().includes(lowerQuery)
      const textMatch = resource.text?.toLowerCase().includes(lowerQuery)
      const tagsMatch = resource.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      
      return titleMatch || urlMatch || notesMatch || textMatch || tagsMatch
    })
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
