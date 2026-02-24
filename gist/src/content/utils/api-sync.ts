export interface SyncResult {
  success: boolean
  message?: string
  syncedCount?: number
  failedCount?: number
}

const DEFAULT_API_URL = 'http://localhost:8000'

export async function syncResourceToApi(
  resource: { url: string; title: string; text?: string; notes: string; tags: string[] },
  apiUrl: string = DEFAULT_API_URL
): Promise<SyncResult> {
  try {
    const content = buildDocumentContent(resource)
    
    const response = await fetch(`${apiUrl}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    return { success: true, message: data.message }
  } catch (error) {
    console.error('[ApiSync] Failed to sync resource:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function syncAllResourcesToApi(
  resources: Array<{ id: string; url: string; title: string; text?: string; notes: string; tags: string[] }>,
  apiUrl: string = DEFAULT_API_URL
): Promise<SyncResult> {
  if (resources.length === 0) {
    return { success: true, message: 'No resources to sync' }
  }

  let syncedCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const resource of resources) {
    const result = await syncResourceToApi(resource, apiUrl)
    if (result.success) {
      syncedCount++
    } else {
      failedCount++
      errors.push(`${resource.title}: ${result.message}`)
    }
  }

  const message = failedCount > 0 
    ? `Synced ${syncedCount}/${resources.length} resources. Failed: ${errors.join(', ')}`
    : `Successfully synced all ${syncedCount} resources`

  return { 
    success: failedCount === 0, 
    message,
    syncedCount,
    failedCount 
  }
}

export async function syncResourceById(id: string, apiUrl: string = DEFAULT_API_URL): Promise<SyncResult> {
  const { getResource } = await import('./resource-storage')
  const resource = await getResource(id)
  
  if (!resource) {
    return { success: false, message: `Resource with id ${id} not found` }
  }

  return syncResourceToApi(resource, apiUrl)
}

function buildDocumentContent(resource: { url: string; title: string; text?: string; notes: string; tags: string[] }): string {
  const parts: string[] = []
  
  if (resource.title) {
    parts.push(`Title: ${resource.title}`)
  }
  
  if (resource.url) {
    parts.push(`URL: ${resource.url}`)
  }
  
  if (resource.tags && resource.tags.length > 0) {
    parts.push(`Tags: ${resource.tags.join(', ')}`)
  }
  
  if (resource.text) {
    parts.push(`Content: ${resource.text}`)
  }
  
  if (resource.notes) {
    parts.push(`Notes: ${resource.notes}`)
  }
  
  return parts.join('\n\n')
}
