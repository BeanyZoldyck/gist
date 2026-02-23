import { searchResources as searchQdrant, upsertResource, deleteResource as deleteFromQdrant } from './utils/qdrant-client'

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

const DB_NAME = 'gist-resources'
const DB_VERSION = 2
const STORE_NAME = 'resources'

console.log('[Background] Service worker starting up...')
console.log('[Background] Chrome API available:', typeof chrome !== 'undefined')

chrome.commands.getAll((commands) => {
  console.log('[Background] Registered commands:', commands)
  console.log('[Background] Number of commands:', commands?.length)
  if (commands && commands.length > 0) {
    commands.forEach((cmd) => {
      console.log('[Background] Command:', cmd.name, 'Shortcut:', cmd.shortcut)
    })
  }
})

let db: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase> | null = null

chrome.commands.onCommand.addListener((command) => {
  console.log('[Background] Command received:', command)
  if (command === 'toggle_side_panel') {
    console.log('[Background] Toggle side panel command triggered')

    chrome.sidePanel.setOptions({ enabled: true }, () => {
      console.log('[Background] Side panel enabled, error:', chrome.runtime.lastError)
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }, () => {
        console.log('[Background] Side panel opened, error:', chrome.runtime.lastError)
      })
    })
  } else if (command === 'save_current_url') {
    console.log('[Background] Save current URL command triggered')
    saveCurrentTabUrl()
  } else if (command === 'save_with_metadata') {
    console.log('[Background] Save with metadata command triggered')
    saveCurrentTabWithMetadata()
  }
})

chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] New connection:', port.name)
  if (port.name === 'sidePanel') {
    console.log('[Background] Side panel connected')
    port.onMessage.addListener((message) => {
      console.log('[Background] Message from side panel:', message)
    })
    port.onDisconnect.addListener(() => {
      console.log('[Background] Side panel disconnected')
    })
  }
})

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated')
  chrome.commands.getAll((commands) => {
    console.log('[Background] Commands after install:', commands)
  })
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extension started up')
})

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[Background] IndexedDB failed to open:', request.error)
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      db.onversionchange = () => {
        db?.close()
        db = null
        dbPromise = null
      }
      console.log('[Background] IndexedDB opened successfully')
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('url', 'url', { unique: false })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('pageUrl', 'pageUrl', { unique: false })
        store.createIndex('pageTitle', 'pageTitle', { unique: false })
        store.createIndex('pageDescription', 'pageDescription', { unique: false })
        store.createIndex('linkContext', 'linkContext', { unique: false })
        console.log('[Background] Created IndexedDB object store:', STORE_NAME)
      } else {
        const transaction = request.transaction
        const store = transaction?.objectStore(STORE_NAME)

        if (store) {
          if (oldVersion < 2) {
            store.createIndex('pageUrl', 'pageUrl', { unique: false })
            store.createIndex('pageTitle', 'pageTitle', { unique: false })
            store.createIndex('pageDescription', 'pageDescription', { unique: false })
            store.createIndex('linkContext', 'linkContext', { unique: false })
            console.log('[Background] Added new indexes to existing store:', STORE_NAME)
          }
        }
      }
    }

    request.onblocked = () => {
      console.warn('[Background] IndexedDB open blocked - another connection exists')
    }
  })

  return dbPromise
}

async function getAllFromDB(): Promise<Resource[]> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as Resource[])
      }

      request.onerror = () => {
        console.error('[Background] Failed to get all resources:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Background] getAllFromDB failed:', error)
    return []
  }
}

async function getResourceFromDB(id: string): Promise<Resource | null> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve((request.result as Resource) || null)
      }

      request.onerror = () => {
        console.error('[Background] Failed to get resource:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Background] getResourceFromDB failed:', error)
    return null
  }
}

async function saveResourceToDB(resource: Resource): Promise<Resource> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(resource)

      request.onsuccess = () => {
        console.log('[Background] Saved resource:', resource.id)
        resolve(resource)
      }

      request.onerror = () => {
        console.error('[Background] Failed to save resource:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Background] saveResourceToDB failed:', error)
    throw error
  }
}

async function deleteResourceFromDB(id: string): Promise<void> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        console.log('[Background] Deleted resource:', id)
        resolve()
      }

      request.onerror = () => {
        console.error('[Background] Failed to delete resource:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Background] deleteResourceFromDB failed:', error)
    throw error
  }
}

async function deleteAllResourcesFromDB(): Promise<void> {
  try {
    const database = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('[Background] Deleted all resources')
        resolve()
      }

      request.onerror = () => {
        console.error('[Background] Failed to delete all resources:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Background] deleteAllResourcesFromDB failed:', error)
    throw error
  }
}

async function keywordSearch(query: string): Promise<Resource[]> {
  const allResources = await getAllFromDB()
  const lowerQuery = query.toLowerCase()

  return allResources.filter((resource: Resource) => {
    const titleMatch = resource.title.toLowerCase().includes(lowerQuery)
    const urlMatch = resource.url.toLowerCase().includes(lowerQuery)
    const notesMatch = resource.notes.toLowerCase().includes(lowerQuery)
    const textMatch = resource.text?.toLowerCase().includes(lowerQuery)
    const tagsMatch = resource.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    const pageUrlMatch = resource.pageUrl?.toLowerCase().includes(lowerQuery)
    const pageTitleMatch = resource.pageTitle?.toLowerCase().includes(lowerQuery)
    const pageDescMatch = resource.pageDescription?.toLowerCase().includes(lowerQuery)
    const linkContextMatch = resource.linkContext?.toLowerCase().includes(lowerQuery)

    return titleMatch || urlMatch || notesMatch || textMatch || tagsMatch ||
           pageUrlMatch || pageTitleMatch || pageDescMatch || linkContextMatch
  })
}

function hybridMerge(qdrantResults: any[], keywordResults: Resource[]): Resource[] {
  const seen = new Set<string>()
  const merged: Resource[] = []

  for (const r of qdrantResults) {
    const id = r.id || r.payload?.id
    if (id && !seen.has(id)) {
      seen.add(id)
      merged.push({
        id,
        url: r.payload?.url || r.url,
        title: r.payload?.title || r.title,
        text: r.payload?.text || r.text,
        notes: r.payload?.notes || r.notes,
        tags: r.payload?.tags || r.tags,
        createdAt: r.payload?.createdAt || r.createdAt,
        updatedAt: r.payload?.updatedAt || r.updatedAt,
        pageUrl: r.payload?.pageUrl || r.pageUrl,
        pageTitle: r.payload?.pageTitle || r.pageTitle,
        pageDescription: r.payload?.pageDescription || r.pageDescription,
        linkContext: r.payload?.linkContext || r.linkContext,
      })
    }
  }

  for (const r of keywordResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id)
      merged.push(r)
    }
  }

  return merged
}

function broadcastUpdate() {
  chrome.runtime.sendMessage({ type: 'RESOURCES_UPDATED' }).catch(() => {
  })
}

  async function saveCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) {
      console.warn('[Background] No active tab found or tab has no URL')
      return
    }

    const url = tab.url
    const title = tab.title || new URL(url).hostname
    const now = Date.now()

    const resource: Resource = {
      id: `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      title,
      text: '',
      notes: '',
      tags: [],
      createdAt: now,
      pageUrl: url,
      pageTitle: title,
      pageDescription: '',
      linkContext: ''
    }

    await saveResourceToDB(resource)

    // Try to upsert to Qdrant (non-fatal)
    try {
      await upsertResource({
        id: resource.id,
        vector: [],
        payload: {
          url: resource.url,
          title: resource.title,
          text: resource.text || '',
          notes: resource.notes,
          tags: resource.tags,
          createdAt: resource.createdAt,
          updatedAt: resource.updatedAt || resource.createdAt,
          pageUrl: resource.pageUrl,
          pageTitle: resource.pageTitle,
          pageDescription: resource.pageDescription || '',
          linkContext: resource.linkContext || ''
        }
      })
    } catch (e) {
      console.log('[Background] Qdrant upsert failed (non-fatal):', e)
    }

    broadcastUpdate()
    console.log('[Background] Saved current URL:', url)
  } catch (error) {
    console.error('[Background] Failed to save current URL:', error)
  }
}

async function saveCurrentTabWithMetadata() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) {
      console.warn('[Background] No active tab found or tab has no URL')
      return
    }

    const url = tab.url
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
    const now = Date.now()

    let resource: Resource
    let notificationTitle = 'Page Saved'
    let notificationMessage = tab.title || url

    if (isYouTube) {
      // For YouTube videos, try to extract metadata from the page
      try {
        const response = await chrome.tabs.sendMessage(tab.id!, { type: 'GET_YOUTUBE_METADATA' })
        const metadata = response?.data

        const notes = metadata?.description ? metadata.description.substring(0, 500) : ''
        const tags = metadata?.keywords?.slice(0, 5) || []
        if (metadata?.channel) {
          tags.unshift(metadata.channel)
        }

        resource = {
          id: `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          title: metadata?.title || tab.title || 'YouTube Video',
          text: metadata?.description || '',
          notes: notes,
          tags: tags.filter(Boolean),
          createdAt: now,
          pageUrl: url,
          pageTitle: metadata?.title || tab.title || 'YouTube Video',
          pageDescription: metadata?.description || '',
          linkContext: metadata?.channel ? `Channel: ${metadata.channel}` : ''
        }

        notificationTitle = 'YouTube Video Saved'
        notificationMessage = metadata?.title ? `${metadata.title}\n${metadata.channel}` : tab.title || ''
      } catch (error) {
        // Content script not available, fall back to basic save
        console.warn('[Background] Could not extract YouTube metadata, using basic info')
        resource = {
          id: `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          title: tab.title || 'YouTube Video',
          text: '',
          notes: '',
          tags: ['youtube'],
          createdAt: now,
          pageUrl: url,
          pageTitle: tab.title || 'YouTube Video',
          pageDescription: '',
          linkContext: ''
        }
      }
    } else {
      // For non-YouTube pages, save with basic info
      resource = {
        id: `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        title: tab.title || new URL(url).hostname,
        text: '',
        notes: '',
        tags: [],
        createdAt: now,
        pageUrl: url,
        pageTitle: tab.title || new URL(url).hostname,
        pageDescription: '',
        linkContext: ''
      }
    }

    await saveResourceToDB(resource)
    // Try to upsert to Qdrant (non-fatal)
    try {
      await upsertResource({
        id: resource.id,
        vector: [],
        payload: {
          url: resource.url,
          title: resource.title,
          text: resource.text || '',
          notes: resource.notes,
          tags: resource.tags,
          createdAt: resource.createdAt,
          updatedAt: resource.updatedAt || resource.createdAt,
          pageUrl: resource.pageUrl,
          pageTitle: resource.pageTitle,
          pageDescription: resource.pageDescription || '',
          linkContext: resource.linkContext || ''
        }
      })
    } catch (e) {
      console.log('[Background] Qdrant upsert failed (non-fatal):', e)
    }

    broadcastUpdate()
    console.log('[Background] Saved current URL with metadata:', url)

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'public/logo.png',
      title: notificationTitle,
      message: notificationMessage.length > 100 ? notificationMessage.substring(0, 100) + '...' : notificationMessage
    })
  } catch (error) {
    console.error('[Background] Failed to save current URL with metadata:', error)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (message.type) {
        case 'GET_ALL_RESOURCES': {
          const resources = await getAllFromDB()
          sendResponse({ success: true, data: resources })
          break
        }
        case 'GET_RESOURCE': {
          const resource = await getResourceFromDB(message.id)
          sendResponse({ success: true, data: resource })
          break
        }
        case 'SAVE_RESOURCE': {
          const now = Date.now()
          const existingResources = await getAllFromDB()
          const existingResource = message.resource.id ? existingResources.find((r: Resource) => r.id === message.resource.id) : null

          const newResource: Resource = {
            ...message.resource,
            id: message.resource.id || `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: existingResource?.createdAt || now,
            updatedAt: now
          }

          await saveResourceToDB(newResource)

          try {
            await upsertResource({
              id: newResource.id,
              vector: [],
              payload: {
                url: newResource.url,
                title: newResource.title,
                text: newResource.text || '',
                notes: newResource.notes,
                tags: newResource.tags,
                createdAt: newResource.createdAt,
                updatedAt: newResource.updatedAt
              }
            })
          } catch (e) {
            console.log('[Background] Qdrant upsert failed (non-fatal):', e)
          }

          broadcastUpdate()
          sendResponse({ success: true, data: newResource })
          break
        }
        case 'DELETE_RESOURCE': {
          await deleteResourceFromDB(message.id)

          try {
            await deleteFromQdrant(message.id)
          } catch (e) {
            console.log('[Background] Qdrant delete failed (non-fatal):', e)
          }

          broadcastUpdate()
          sendResponse({ success: true })
          break
        }
        case 'DELETE_ALL_RESOURCES': {
          // capture all resource ids before clearing local DB so we can try to remove from Qdrant
          const allResources = await getAllFromDB()
          await deleteAllResourcesFromDB()

          // Attempt to delete each resource from Qdrant (non-fatal)
          for (const r of allResources) {
            try {
              await deleteFromQdrant(r.id)
            } catch (e) {
              console.log('[Background] Qdrant delete failed for id', r.id, '(non-fatal):', e)
            }
          }

          broadcastUpdate()
          sendResponse({ success: true })
          break
        }
        case 'UPDATE_TAGS': {
          const resource = await getResourceFromDB(message.id)
          if (!resource) {
            sendResponse({ success: false, error: 'Resource not found' })
            return
          }
          resource.tags = message.tags
          resource.updatedAt = Date.now()
          await saveResourceToDB(resource)
          broadcastUpdate()
          sendResponse({ success: true, data: resource })
          break
        }
        case 'UPDATE_NOTES': {
          const resource = await getResourceFromDB(message.id)
          if (!resource) {
            sendResponse({ success: false, error: 'Resource not found' })
            return
          }
          resource.notes = message.notes
          resource.updatedAt = Date.now()
          await saveResourceToDB(resource)
          broadcastUpdate()
          sendResponse({ success: true, data: resource })
          break
        }
        case 'SEARCH_RESOURCES': {
          const query = message.query?.trim()
          if (!query) {
            const resources = await getAllFromDB()
            sendResponse({ success: true, data: resources, searchMode: 'all' })
            return
          }

          let qdrantResults: any[] = []

          try {
            qdrantResults = await searchQdrant(query, 20)
          } catch (e) {
            console.log('[Background] Qdrant unavailable, using keyword search')
          }

          const keywordResults = await keywordSearch(query)

          if (qdrantResults.length > 0) {
            const merged = hybridMerge(qdrantResults, keywordResults)
            sendResponse({ success: true, data: merged, searchMode: 'hybrid' })
          } else {
            sendResponse({ success: true, data: keywordResults, searchMode: 'keyword' })
          }
          break
        }
        case 'AUTOMATION_ACTION': {
          const result = await handleAutomationAction(message.action, message.payload, _sender)
          sendResponse(result)
          break
        }
        case 'SAVE_CURRENT_PAGE': {
          const now = Date.now()
          const resource: Resource = {
            id: `res_${now}_${Math.random().toString(36).substr(2, 9)}`,
            url: message.url,
            title: message.title,
            text: '',
            notes: '',
            tags: [],
            createdAt: now,
            pageUrl: message.url,
            pageTitle: message.title,
            pageDescription: '',
            linkContext: ''
          }
          await saveResourceToDB(resource)

          // Try to upsert to Qdrant (non-fatal)
          try {
            await upsertResource({
              id: resource.id,
              vector: [],
              payload: {
                url: resource.url,
                title: resource.title,
                text: resource.text || '',
                notes: resource.notes,
                tags: resource.tags,
                createdAt: resource.createdAt,
                updatedAt: resource.updatedAt || resource.createdAt,
                pageUrl: resource.pageUrl,
                pageTitle: resource.pageTitle,
                pageDescription: resource.pageDescription || '',
                linkContext: resource.linkContext || ''
              }
            })
          } catch (e) {
            console.log('[Background] Qdrant upsert failed (non-fatal):', e)
          }

          broadcastUpdate()
          sendResponse({ success: true, data: resource })
          break
        }
        case 'QUERY_WITH_LLM': {
          const question = message.question?.trim()
          if (!question) {
            sendResponse({ success: false, error: 'Question is required' })
            return
          }

          const aiConfig = await getAIRAGConfig()
          if (!aiConfig) {
            sendResponse({ success: false, error: 'AI not configured. Please set up AI in extension settings.' })
            return
          }

          try {
            const result = await queryWithLLM(question, 5, aiConfig)
            sendResponse({ success: true, data: result })
          } catch (error) {
            console.error('[Background] RAG query failed:', error)
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
          }
          break
        }
        case 'CHECK_AI_CONFIG': {
          const config = await getAIRAGConfig()
          sendResponse({ success: true, data: { configured: !!config } })
          break
        }
        default:
          sendResponse({ success: false, error: 'Unknown message type' })
      }
    } catch (error) {
      console.error('[Background] Message handler error:', error)
      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  handleMessage()
  return true
})

async function handleAutomationAction(action: string, payload: any, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (action) {
    case 'navigate': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab found' }
      }
      await chrome.tabs.update(tab.id, { url: payload.url })
      await new Promise(resolve => setTimeout(resolve, 2000))
      return { success: true, data: `Navigated to ${payload.url}` }
    }
    case 'goBack': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab found' }
      }
      await chrome.tabs.goBack(tab.id)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { success: true, data: 'Navigated back' }
    }
    case 'goForward': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        return { success: false, error: 'No active tab found' }
      }
      await chrome.tabs.goForward(tab.id)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { success: true, data: 'Navigated forward' }
    }
    default: {
      // Determine target tab: prefer sender.tab, otherwise use active tab
      let tabId: number | undefined = sender.tab?.id
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        tabId = activeTab?.id
      }

      if (!tabId) {
        return { success: false, error: 'No active tab for content script action' }
      }

      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'AUTOMATION_ACTION',
        action,
        payload
      })
      return response
    }
  }
}

interface RAGConfig {
  apiKey: string
  baseUrl: string
  model: string
}

interface RAGResponse {
  answer: string
  sources: { url: string; title: string; snippet: string; score: number }[]
}

async function getAIRAGConfig(): Promise<RAGConfig | null> {
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

async function searchResourcesForRAG(query: string, limit: number = 5): Promise<any[]> {
  const allResources = await getAllFromDB()
  console.log('[RAG] Total resources:', allResources.length)
  
  if (!query || allResources.length === 0) {
    return allResources.slice(0, limit).map((r: Resource) => ({
      payload: { url: r.url, title: r.title, notes: r.notes || '', text: r.text || '' },
      score: 0.5
    }))
  }
  
  const lowerQuery = query.toLowerCase()
  const scored = allResources.map((r: Resource) => {
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
  console.log('[RAG] Matched:', filtered.length)
  
  return filtered.slice(0, limit).map((s: any) => ({
    payload: { url: s.resource.url, title: s.resource.title, notes: s.resource.notes || '', text: s.resource.text || '' },
    score: s.score / 10
  }))
}

async function queryWithLLM(question: string, maxSources: number, config: RAGConfig): Promise<RAGResponse> {
  let searchResults = await searchResourcesForRAG(question, maxSources * 2)
  
  // Also try Qdrant
  try {
    const qdrantResults = await searchQdrant(question, maxSources)
    if (qdrantResults.length > 0) {
      searchResults = [...searchResults, ...qdrantResults]
      // Dedupe
      const seen = new Set()
      searchResults = searchResults.filter(s => {
        const key = s.payload?.url || s.url
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, maxSources)
    }
  } catch (e) {
    console.log('[RAG] Qdrant failed:', e)
  }

  const sources = searchResults.map((result: any) => ({
    url: result.payload?.url || '',
    title: result.payload?.title || '',
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

Sources:
${context}

Question: ${question}

Answer:`

  const answer = await callLLM(config, systemPrompt)

  return { answer, sources }
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
        messages: [{ role: 'user', content: prompt }],
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
