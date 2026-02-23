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

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Extension context invalidated') || 
      event.reason?.message?.includes('The message port closed')) {
    event.preventDefault()
    console.warn('[Storage] Extension context invalidated. Reload the page to restore full functionality.')
  }
})

async function sendMessage<T>(message: any, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error('Chrome runtime not available'))
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('No response from extension (timeout)'))
      }, timeoutMs)

      chrome.runtime.sendMessage(message, (response: MessageResponse<T> | undefined) => {
        if (settled) return
        settled = true
        clearTimeout(timer)

        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || 'Unknown chrome.runtime error'
          console.error('[Storage] chrome.runtime.lastError:', errMsg)
          if (errMsg.includes('Extension context invalidated')) {
            reject(new Error('Extension context invalidated. Reload the page to restore functionality.'))
          } else {
            reject(new Error(errMsg))
          }
          return
        }

        if (!response) {
          reject(new Error('No response payload from extension'))
          return
        }

        if (!response.success) {
          reject(new Error(response.error || 'Extension returned unsuccessful response'))
          return
        }

        resolve(response.data as T)
      })
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
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
