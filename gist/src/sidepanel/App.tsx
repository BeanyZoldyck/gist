import { useState } from 'react'

interface ChatResponse {
  response: string
  context: string[]
  sources: string[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  context?: string[]
}

interface SyncStatus {
  syncing: boolean
  message: string | null
  success: boolean
}

export default function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [apiUrl, setApiUrl] = useState('http://localhost:8000')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ syncing: false, message: null, success: false })

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/health`)
      const data = await response.json()
      setConnected(data.status === 'healthy')
    } catch (error) {
      setConnected(false)
    }
  }

  const sendQuery = async () => {
    if (!query.trim() || loading) return

    setLoading(true)
    const userMessage: Message = { role: 'user', content: query }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch(`${apiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          top_k: 9,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) throw new Error('API request failed')

      const data: ChatResponse = await response.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        context: data.context
      }
      setMessages(prev => [...prev, assistantMessage])
      setQuery('')
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Error: Failed to connect to RAG API. Make sure the server is running.'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendQuery()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const syncResources = async () => {
    setSyncStatus({ syncing: true, message: 'Syncing resources...', success: false })
    
    try {
      const { getAllResources } = await import('../content/utils/resource-storage')
      const { syncAllResourcesToApi } = await import('../content/utils/api-sync')
      
      const resources = await getAllResources()
      const result = await syncAllResourcesToApi(resources, apiUrl)
      
      setSyncStatus({
        syncing: false,
        message: result.message || (result.success ? 'Sync complete' : 'Sync failed'),
        success: result.success
      })
      
      if (result.success) {
        console.log('[SidePanel] Synced', result.syncedCount, 'resources')
      }
    } catch (error) {
      setSyncStatus({
        syncing: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      })
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-white">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Local RAG Assistant</h2>
          <button 
            onClick={checkConnection} 
            className={`text-sm px-3 py-1 rounded transition-colors ${
              connected === null ? 'bg-gray-700 hover:bg-gray-600' :
              connected ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'
            }`}
          >
            {connected === null ? 'Check Connection' : connected ? '✓ Connected' : '✗ Disconnected'}
          </button>
        </div>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="API URL"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2 mt-3">
          <button 
            onClick={syncResources}
            disabled={syncStatus.syncing}
            className={`flex-1 text-sm px-3 py-2 rounded transition-colors ${
              syncStatus.syncing 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {syncStatus.syncing ? 'Syncing...' : 'Sync Resources'}
          </button>
        </div>
        {syncStatus.message && (
          <div className={`mt-2 text-xs px-3 py-2 rounded ${
            syncStatus.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {syncStatus.message}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p className="mb-2">Ask questions about your knowledge base</p>
            <p className="text-sm">Make sure the RAG API server is running</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-4 ${msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'}`}>
            <div className={`text-xs uppercase tracking-wide mb-1 ${msg.role === 'user' ? 'text-indigo-400' : 'text-green-400'}`}>
              {msg.role}
            </div>
            <div className={`rounded-lg p-3 ${
              msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-800'
            }`}>
              {msg.content}
            </div>
            {msg.context && msg.context.length > 0 && (
              <details className="mt-2 text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-400">Context ({msg.context.length} chunks)</summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {msg.context.map((ctx, i) => (
                    <li key={i} className="break-words">{ctx}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[80%]">
            <div className="text-xs uppercase tracking-wide text-green-400 mb-1">assistant</div>
            <div className="bg-gray-800 rounded-lg p-3">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 resize-none mb-3"
        />
        <div className="flex justify-end gap-2">
          <button 
            onClick={clearChat} 
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Clear
          </button>
          <button 
            onClick={sendQuery} 
            disabled={loading || !query.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
