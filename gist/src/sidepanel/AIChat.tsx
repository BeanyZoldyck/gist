import { useState, useEffect, useRef } from 'react'
import { AIMessage, getAssistant, setAssistantConfig } from '../ai/assistant'

export default function AIChatPanel() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_AI_API_KEY || '')
  const [model, setModel] = useState(import.meta.env.VITE_AI_MODEL || 'openrouter/free')
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_AI_BASE_URL || 'https://openrouter.ai/api/v1')
  const [pageSnapshot, setPageSnapshot] = useState<string>('')
  const [aiConfigured, setAiConfigured] = useState<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const assistant = getAssistant()

  useEffect(() => {
    chrome.storage.local.get(['aiApiKey', 'aiModel', 'aiBaseUrl'], (result: any) => {
      // Resolve effective values: prefer stored values, fall back to build-time env/defaults
      const effectiveApiKey = result.aiApiKey ?? (import.meta.env.VITE_AI_API_KEY || '')
      const effectiveModel = result.aiModel ?? (import.meta.env.VITE_AI_MODEL || 'openrouter/free')
      const effectiveBase = result.aiBaseUrl ?? (import.meta.env.VITE_AI_BASE_URL || 'https://openrouter.ai/api/v1')

      setApiKey(effectiveApiKey)
      setModel(effectiveModel)
      setBaseUrl(effectiveBase)

      // Only set assistant config when we have an API key (to avoid setting an invalid/empty config)
      if (effectiveApiKey) {
        setAssistantConfig({
          apiKey: effectiveApiKey,
          model: effectiveModel,
          baseUrl: effectiveBase
        })
        setAiConfigured(true)
      }
      
      // Also verify via background helper in case storage/defaults differ
      try {
        chrome.runtime.sendMessage({ type: 'CHECK_AI_CONFIG' }, (resp: any) => {
          if (resp && resp.data && typeof resp.data.configured === 'boolean') {
            setAiConfigured(resp.data.configured)
          }
        })
      } catch (e) {
        // ignore — leave aiConfigured based on effectiveApiKey
      }
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTakeSnapshot = async () => {
    setIsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTOMATION_ACTION',
        action: 'snapshot'
      })

      if (response.success) {
        setPageSnapshot(response.data.snapshot)
        
        const snapshotMessage: AIMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Captured snapshot: ${response.data.title}`,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, snapshotMessage])
      }
    } catch (error) {
      const errorMessage: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Failed to capture snapshot: ${error}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = () => {
    setAssistantConfig({
      apiKey,
      model,
      baseUrl
    })
    chrome.storage.local.set({ aiApiKey: apiKey, aiModel: model, aiBaseUrl: baseUrl })
    // Mark configured if API key provided
    if (apiKey) setAiConfigured(true)
    setShowSettings(false)
  }

  const handleClearChat = () => {
    setMessages([])
    assistant.clearMessages()
  }

  const handleExportChat = () => {
    const markdown = assistant.exportMarkdown()
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSendMessage = async () => {
    if (!aiConfigured) {
      const info: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ AI is not configured. Open settings (⚙️) and save your API key to enable assistant.',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, info])
      return
    }

    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    const assistantMessageId = `msg_${Date.now()}`

    const assistantMessage: AIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      let fullContent = ''
      for await (const chunk of assistant.chatStream(userMessage, {
        pageSnapshot,
        currentUrl: window.location.href,
        pageTitle: document.title
      })) {
        fullContent += chunk
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ))
      }

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ))

      const actionResult = await parseAndExecuteAction(fullContent)
      if (actionResult) {
        const resultMessage: AIMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: actionResult,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, resultMessage])

        if (actionResult.includes('snapshot')) {
          await updatePageSnapshot()
        }
      }
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: errorMessage, isStreaming: false }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const parseAndExecuteAction = async (response: string): Promise<string | null> => {
    try {
      console.log('[AIChat] Parsing response:', response.substring(0, 200))
      
      let cleanResponse = response.trim()
      
      if (cleanResponse.startsWith('Error:') || cleanResponse.startsWith('error:')) {
        console.error('[AIChat] AI returned error:', response)
        return `❌ AI Error: ${response.substring(0, 200)}`
      }
      
      cleanResponse = cleanResponse.replace(/```json\n?|\n?```/g, '').trim()
      
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[AIChat] No JSON found in response:', cleanResponse.substring(0, 200))
        return `⚠️ Could not parse action from response. Please try rephrasing.`
      }
      
      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.action) {
        console.error('[AIChat] No action in parsed JSON:', parsed)
        return `⚠️ No action found. Response: ${cleanResponse.substring(0, 100)}`
      }

      const { action, parameters } = parsed

      if (action === 'ask_snapshot') {
        return '📸 Please take a snapshot of page using button above so I can see the current state.'
      }

      console.log('[AIChat] Executing action:', action, parameters)

      const result = await chrome.runtime.sendMessage({
        type: 'AUTOMATION_ACTION',
        action,
        payload: parameters || {}
      })

      if (result.success) {
        return `✓ Executed: ${action}\n${result.data}`
      } else {
        return `✗ Failed: ${action}\n${result.error}`
      }
    } catch (error) {
      console.error('[AIChat] Error parsing action:', error, 'Response:', response.substring(0, 200))
      return `⚠️ Failed to parse action. Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  const updatePageSnapshot = async () => {
    const response = await chrome.runtime.sendMessage({
      type: 'AUTOMATION_ACTION',
      action: 'snapshot'
    })

    if (response.success) {
      setPageSnapshot(response.data.snapshot)
    }
  }

  const getMessageIcon = (role: string) => {
    return role === 'user' ? '👤' : '🤖'
  }

  return (
    <div className="ai-chat-container">
      {showSettings && (
        <div className="ai-settings-panel">
          <div className="settings-header">
            <h3>AI Configuration</h3>
            <button onClick={() => setShowSettings(false)} className="btn-close">✕</button>
          </div>
          <div className="settings-body">
            <div className="setting-field">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="setting-input"
              />
            </div>
            <div className="setting-field">
              <label>Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="glm-4.7-flash"
                className="setting-input"
              />
            </div>
            <div className="setting-field">
              <label>Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.z.ai/api/paas/v4"
                className="setting-input"
              />
            </div>
            <button onClick={handleSaveSettings} className="btn-save-settings">
              Save Configuration
            </button>
          </div>
        </div>
      )}

      <div className="ai-header">
        <h2>AI Assistant</h2>
        <div className="ai-config-status" style={{ marginLeft: 12 }}>
          {aiConfigured ? <span title="AI configured">✅ Configured</span> : <span title="AI not configured">❌ Not configured</span>}
        </div>
        <div className="header-actions">
          <button onClick={() => setShowSettings(true)} className="btn-icon" title="Settings">
            ⚙️
          </button>
          <button onClick={handleTakeSnapshot} className="btn-icon" title="Capture Snapshot" disabled={isLoading}>
            📸
          </button>
          <button onClick={handleClearChat} className="btn-icon" title="Clear Chat">
            🗑️
          </button>
          <button onClick={handleExportChat} className="btn-icon" title="Export Chat">
            📥
          </button>
        </div>
      </div>

      <div className="ai-messages" ref={messagesEndRef}>
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="welcome-icon">🤖</div>
            <div className="welcome-text">
              <h3>Welcome to AI Assistant</h3>
              <p>I can help you automate browser tasks. Try asking me to:</p>
              <ul>
                <li>Click on buttons or links</li>
                <li>Fill out forms</li>
                <li>Navigate to websites</li>
                <li>Search the web</li>
                <li>Extract information from pages</li>
              </ul>
              <p>Use the 📸 button to capture a page snapshot first!</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            <div className="message-header">
              <span className="message-icon">{getMessageIcon(message.role)}</span>
              <span className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant message-loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <div className="ai-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
            }
          }}
          placeholder={aiConfigured ? "Ask me to automate something... (e.g., 'Click on the submit button')" : "AI not configured — open settings (⚙️) to set API key"}
          className="ai-input"
          disabled={isLoading || !aiConfigured}
          rows={3}
        />
        <button 
          onClick={handleSendMessage}
          className="btn-send"
          disabled={!aiConfigured || !input.trim() || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  )
}
