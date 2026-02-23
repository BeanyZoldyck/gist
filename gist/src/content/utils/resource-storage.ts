export interface Resource {
  id: string
  url: string
  title: string
  text?: string
  notes: string
  tags: string[]
  createdAt: number
  updatedAt?: number
  pageUrl: string
  pageTitle: string
  pageDescription?: string
  linkContext?: string
}

interface MessageResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

async function sendMessage<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        console.error('[Storage] Chrome runtime error:', chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError.message))
      } else if (!response?.success) {
        console.error('[Storage] Message failed:', response?.error)
        reject(new Error(response?.error || 'Unknown error'))
      } else {
        resolve(response.data as T)
      }
    })
  })
}

export async function getAllResources(): Promise<Resource[]> {
  try {
    return await sendMessage<Resource[]>({ type: 'GET_ALL_RESOURCES' })
  } catch (error) {
    console.error('[Storage] Failed to get resources:', error)
    return []
  }
}

export async function getResource(id: string): Promise<Resource | null> {
  try {
    return await sendMessage<Resource | null>({ type: 'GET_RESOURCE', id })
  } catch (error) {
    console.error('[Storage] Failed to get resource:', error)
    return null
  }
}

export async function saveResource(resource: Omit<Resource, 'id' | 'createdAt'> & { id?: string }): Promise<Resource> {
  try {
    return await sendMessage<Resource>({ type: 'SAVE_RESOURCE', resource })
  } catch (error) {
    console.error('[Storage] Failed to save resource:', error)
    throw error
  }
}

export async function deleteResource(id: string): Promise<void> {
  try {
    await sendMessage<void>({ type: 'DELETE_RESOURCE', id })
  } catch (error) {
    console.error('[Storage] Failed to delete resource:', error)
    throw error
  }
}

export async function deleteAllResources(): Promise<void> {
  try {
    await sendMessage<void>({ type: 'DELETE_ALL_RESOURCES' })
  } catch (error) {
    console.error('[Storage] Failed to delete all resources:', error)
    throw error
  }
}


export async function updateResourceTags(id: string, tags: string[]): Promise<Resource | null> {
  try {
    return await sendMessage<Resource | null>({ type: 'UPDATE_TAGS', id, tags })
  } catch (error) {
    console.error('[Storage] Failed to update tags:', error)
    return null
  }
}

export async function updateResourceNotes(id: string, notes: string): Promise<Resource | null> {
  try {
    return await sendMessage<Resource | null>({ type: 'UPDATE_NOTES', id, notes })
  } catch (error) {
    console.error('[Storage] Failed to update notes:', error)
    return null
  }
}

export async function searchResources(query: string): Promise<Resource[]> {
  try {
    return await sendMessage<Resource[]>({ type: 'SEARCH_RESOURCES', query })
  } catch (error) {
    console.error('[Storage] Failed to search resources:', error)
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
