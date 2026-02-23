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

function broadcastUpdate() {
  chrome.runtime.sendMessage({ type: 'RESOURCES_UPDATED' }).catch(() => {
  })
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
          broadcastUpdate()
          sendResponse({ success: true, data: newResource })
          break
        }
        case 'DELETE_RESOURCE': {
          await deleteResourceFromDB(message.id)
          broadcastUpdate()
          sendResponse({ success: true })
          break
        }
        case 'DELETE_ALL_RESOURCES': {
          await deleteAllResourcesFromDB()
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
            sendResponse({ success: true, data: resources })
            return
          }
          
          const allResources = await getAllFromDB()
          const lowerQuery = query.toLowerCase()
          
          const results = allResources.filter((resource: Resource) => {
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
          
          sendResponse({ success: true, data: results })
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
