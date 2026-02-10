import { useState } from 'react'
import './App.css'

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

export default function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [apiUrl, setApiUrl] = useState('http://localhost:8000')
  const [connected, setConnected] = useState<boolean | null>(null)

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

  return (
    <div className="rag-container">
      <div className="rag-header">
        <h2>Local RAG Assistant</h2>
        <div className="connection-status">
          <button onClick={checkConnection} className="status-btn">
            {connected === null ? 'Check Connection' : connected ? '✓ Connected' : '✗ Disconnected'}
          </button>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="API URL"
            className="api-url-input"
          />
        </div>
      </div>

      <div className="rag-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Ask questions about your knowledge base</p>
            <p className="hint">Make sure the RAG API server is running</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-role">{msg.role}</div>
            <div className="message-content">{msg.content}</div>
            {msg.context && msg.context.length > 0 && (
              <details className="message-context">
                <summary>Context ({msg.context.length} chunks)</summary>
                <ul>
                  {msg.context.map((ctx, i) => (
                    <li key={i}>{ctx}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {loading && <div className="message assistant loading">Thinking...</div>}
      </div>

      <div className="rag-input">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          rows={3}
        />
        <div className="rag-actions">
          <button onClick={clearChat} className="secondary-btn">Clear</button>
          <button onClick={sendQuery} disabled={loading || !query.trim()} className="primary-btn">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
