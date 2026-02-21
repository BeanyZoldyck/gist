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

const DB_NAME = 'gist-resources'
const DB_VERSION = 1
const STORE_NAME = 'resources'

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      const db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('url', 'url', { unique: false })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        console.log('[IndexedDB] Created object store:', STORE_NAME)
      }
    }
  })
}

async function getAllFromDB(): Promise<Resource[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      resolve(request.result as Resource[])
    }

    request.onerror = () => {
      console.error('[IndexedDB] Failed to get all resources:', request.error)
      reject(request.error)
    }
  })
}

export async function getAllResources(): Promise<Resource[]> {
  try {
    return await getAllFromDB()
  } catch (error) {
    console.error('[Storage] Failed to get resources:', error)
    return []
  }
}

export async function getResource(id: string): Promise<Resource | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => {
      resolve((request.result as Resource) || null)
    }

    request.onerror = () => {
      console.error('[IndexedDB] Failed to get resource:', request.error)
      reject(request.error)
    }
  })
}

export async function saveResource(resource: Omit<Resource, 'id' | 'createdAt'> & { id?: string }): Promise<Resource> {
  const now = Date.now()
  const existingResources = await getAllFromDB()
  
  const existingResource = resource.id ? existingResources.find(r => r.id === resource.id) : null
  
  const newResource: Resource = {
    ...resource,
    id: resource.id || `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: existingResource?.createdAt || now,
    updatedAt: now
  }
  
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(newResource)

    request.onsuccess = () => {
      console.log('[Storage] Saved resource:', newResource.id)
      resolve(newResource)
    }

    request.onerror = () => {
      console.error('[IndexedDB] Failed to save resource:', request.error)
      reject(request.error)
    }
  })
}

export async function deleteResource(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => {
      console.log('[Storage] Deleted resource:', id)
      resolve()
    }

    request.onerror = () => {
      console.error('[IndexedDB] Failed to delete resource:', request.error)
      reject(request.error)
    }
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
    const allResources = await getAllResources()
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
