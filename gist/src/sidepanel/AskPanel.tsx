import { useState, useRef, useEffect } from 'react'

interface Source {
  url: string
  title: string
  snippet: string
  score: number
}

interface RAGResponse {
  answer: string
  sources: Source[]
}

export default function AskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<RAGResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAIConfig()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [answer])

  const checkAIConfig = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AI_CONFIG' })
      setAiConfigured(response.success && response.data?.configured)
    } catch (err) {
      setAiConfigured(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || isLoading) return

    console.log('[AskPanel] Asking:', question.trim())
    setIsLoading(true)
    setError(null)
    setAnswer(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'QUERY_WITH_LLM',
        question: question.trim()
      })

      console.log('[AskPanel] Response:', response)

      if (response.success) {
        console.log('[AskPanel] Data:', response.data)
        setAnswer(response.data)
      } else {
        setError(response.error || 'Failed to get answer')
      }
    } catch (err) {
      console.error('[AskPanel] Error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const openSource = (url: string) => {
    window.open(url, '_blank')
  }

  if (aiConfigured === false) {
    return (
      <div className="ask-container">
        <div className="ask-header">
          <h2>Ask Your Links</h2>
        </div>
        <div className="ask-empty">
          <div className="empty-icon">⚙️</div>
          <div className="empty-title">AI Not Configured</div>
          <div className="empty-text">
            Please configure AI in the settings to use the Ask feature.
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage?.() || window.open('settings.html', '_blank') }} className="settings-link">
            Open Settings
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="ask-container">
      <div className="ask-header">
        <h2>Ask Your Links</h2>
        <p className="ask-subtitle">Ask questions about your saved links and get AI-powered answers</p>
      </div>

      <div className="ask-input-section">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your saved links... (e.g., 'What did I save about React tutorials?')"
          className="ask-input"
          disabled={isLoading}
          rows={3}
        />
        <button 
          onClick={handleAsk} 
          className="ask-button"
          disabled={!question.trim() || isLoading}
        >
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {error && (
        <div className="ask-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {answer && (
        <div className="ask-results">
          <div className="answer-section">
            <div className="answer-label">Answer</div>
            <div className="answer-content">{answer.answer}</div>
          </div>

          {answer.sources.length > 0 && (
            <div className="sources-section">
              <div className="sources-label">Sources ({answer.sources.length})</div>
              <div className="sources-list">
                {answer.sources.map((source, index) => (
                  <div 
                    key={index} 
                    className="source-card"
                    onClick={() => openSource(source.url)}
                  >
                    <div className="source-title">{source.title || source.url}</div>
                    <div className="source-url">{source.url}</div>
                    {source.snippet && (
                      <div className="source-snippet">{source.snippet}</div>
                    )}
                    <div className="source-score">Relevance: {Math.round(source.score * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!answer && !isLoading && !error && (
        <div className="ask-hints">
          <div className="hints-title">Try asking:</div>
          <div className="hints-list">
            <button onClick={() => setQuestion("What did I save about startups?")} className="hint-button">
              "What did I save about startups?"
            </button>
            <button onClick={() => setQuestion("Show me links about AI/ML")} className="hint-button">
              "Show me links about AI/ML"
            </button>
            <button onClick={() => setQuestion("What tutorials have I saved?")} className="hint-button">
              "What tutorials have I saved?"
            </button>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
