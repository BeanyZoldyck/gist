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

const RESOURCES_KEY = 'gist_resources'
const MAX_RESOURCES = 500

export async function getAllResources(): Promise<Resource[]> {
  const result = await chrome.storage.local.get(RESOURCES_KEY)
  return (result[RESOURCES_KEY] as Resource[]) || []
}

export async function getResource(id: string): Promise<Resource | null> {
  const resources = await getAllResources()
  return resources.find(r => r.id === id) || null
}

export async function saveResource(resource: Omit<Resource, 'id' | 'createdAt'> & { id?: string }): Promise<Resource> {
  const resources = await getAllResources()
  const now = Date.now()
  
  const newResource: Resource = {
    ...resource,
    id: resource.id || `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: resource.id ? resources.find(r => r.id === resource.id)?.createdAt || now : now,
    updatedAt: now
  }
  
  const existingIndex = resources.findIndex(r => r.id === newResource.id)
  if (existingIndex >= 0) {
    resources[existingIndex] = newResource
  } else {
    resources.unshift(newResource)
  }
  
  if (resources.length > MAX_RESOURCES) {
    resources.splice(MAX_RESOURCES)
  }
  
  await chrome.storage.local.set({ [RESOURCES_KEY]: resources })
  return newResource
}

export async function deleteResource(id: string): Promise<void> {
  const resources = await getAllResources()
  const filtered = resources.filter(r => r.id !== id)
  await chrome.storage.local.set({ [RESOURCES_KEY]: filtered })
}

export async function updateResourceTags(id: string, tags: string[]): Promise<Resource | null> {
  const resources = await getAllResources()
  const index = resources.findIndex(r => r.id === id)
  if (index < 0) return null
  
  resources[index].tags = tags
  resources[index].updatedAt = Date.now()
  await chrome.storage.local.set({ [RESOURCES_KEY]: resources })
  return resources[index]
}

export async function updateResourceNotes(id: string, notes: string): Promise<Resource | null> {
  const resources = await getAllResources()
  const index = resources.findIndex(r => r.id === id)
  if (index < 0) return null
  
  resources[index].notes = notes
  resources[index].updatedAt = Date.now()
  await chrome.storage.local.set({ [RESOURCES_KEY]: resources })
  return resources[index]
}

export async function searchResources(query: string): Promise<Resource[]> {
  const resources = await getAllResources()
  if (!query.trim()) return resources
  
  const lowerQuery = query.toLowerCase()
  return resources.filter(resource => {
    const titleMatch = resource.title.toLowerCase().includes(lowerQuery)
    const urlMatch = resource.url.toLowerCase().includes(lowerQuery)
    const notesMatch = resource.notes.toLowerCase().includes(lowerQuery)
    const tagMatch = resource.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    
    return titleMatch || urlMatch || notesMatch || tagMatch
  })
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
