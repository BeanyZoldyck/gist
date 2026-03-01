export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface AIConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export class AIAssistant {
  private messages: AIMessage[] = []
  private config: AIConfig | null = null

  constructor(config?: AIConfig) {
    if (config) {
      this.config = config
    }
  }

  setConfig(config: AIConfig): void {
    this.config = config
  }

  async chat(userMessage: string, context?: {
    pageSnapshot?: string
    currentUrl?: string
    pageTitle?: string
  }): Promise<{ content: string }> {
    this.addMessage('user', userMessage)

    let pageContext = 'Current Page Snapshot: ' + (context?.pageSnapshot || 'Not captured')
    pageContext = pageContext + '\nCurrent URL: ' + (context?.currentUrl || 'Unknown')
    pageContext = pageContext + '\nPage Title: ' + (context?.pageTitle || 'Unknown')

    const systemPrompt = `You are a browser automation assistant. Available actions:
 - snapshot: Capture an ARIA snapshot of the current page
 - navigate: Navigate to a URL (requires url parameter)
 - goBack/goForward: Navigate browser history
 - click: Click on an element (by element name or index ref)
 - type: Type text into an input field
 - wait: Wait for specified time (seconds)

${pageContext}

IMPORTANT: Respond ONLY with a JSON object containing the action to execute. Format:
{
  "action": "action_name",
  "parameters": {}
}

Available actions and their parameters:
- snapshot: {}
- navigate: { "url": "https://example.com" }
- goBack: {}
- goForward: {}
- click: { "element": "Submit" } or { "ref": "1" }
- type: { "text": "Hello", "element": "Input" } or { "text": "Hello", "ref": "2" }
- wait: { "time": 2 }

If you need more context to perform the action, ask the user to take a snapshot first by setting action to "ask_snapshot".

Examples:
{"action": "snapshot", "parameters": {}}
{"action": "click", "parameters": {"element": "Submit"}}
{"action": "type", "parameters": {"text": "hello", "element": "Search input"}}
{"action": "navigate", "parameters": {"url": "https://google.com"}}`

    const response = await this.callAI(systemPrompt)

    // If the AI requested a snapshot action, request it from the extension background
    try {
      const parsed = JSON.parse(response.content)
      if (parsed && parsed.action === 'snapshot') {
        // request snapshot via chrome runtime and include result in the returned content
        const snapshotResult = await requestSnapshotFromBackground()
        const composite = {
          ai: response.content,
          snapshot: snapshotResult
        }
        this.addMessage('assistant', JSON.stringify(composite))
        return { content: JSON.stringify(composite) }
      }
    } catch (e) {
      // not JSON or parsing failed - ignore and continue
    }

    this.addMessage('assistant', response.content)

    return response
  }

  async *chatStream(userMessage: string, context?: {
    pageSnapshot?: string
    currentUrl?: string
    pageTitle?: string
  }): AsyncGenerator<string> {
    this.addMessage('user', userMessage)

    let pageContext = 'Current Page Snapshot: ' + (context?.pageSnapshot || 'Not captured')
    pageContext = pageContext + '\nCurrent URL: ' + (context?.currentUrl || 'Unknown')
    pageContext = pageContext + '\nPage Title: ' + (context?.pageTitle || 'Unknown')

    const systemPrompt = `You are a browser automation assistant. Available actions:
 - snapshot: Capture an ARIA snapshot of the current page
 - navigate: Navigate to a URL (requires url parameter)
 - goBack/goForward: Navigate browser history
 - click: Click on an element (by element name or index ref)
 - type: Type text into an input field
 - wait: Wait for specified time (seconds)

${pageContext}

IMPORTANT: Respond ONLY with a JSON object containing the action to execute. Format:
{
  "action": "action_name",
  "parameters": {}
}

Available actions and their parameters:
- snapshot: {}
- navigate: { "url": "https://example.com" }
- goBack: {}
- goForward: {}
- click: { "element": "Submit" } or { "ref": "1" }
- type: { "text": "Hello", "element": "Input" } or { "text": "Hello", "ref": "2" }
- wait: { "time": 2 }

If you need more context to perform the action, ask the user to take a snapshot first by setting action to "ask_snapshot".

Examples:
{"action": "snapshot", "parameters": {}}
{"action": "click", "parameters": {"element": "Submit"}}
{"action": "type", "parameters": {"text": "hello", "element": "Search input"}}
{"action": "navigate", "parameters": {"url": "https://google.com"}}`

    let fullResponse = ''
    try {
      const stream = await this.callAIStream(systemPrompt)
      for await (const chunk of stream) {
        fullResponse += chunk
        yield chunk
      }
      // After the full response is collected, check if the assistant asked for a snapshot
      try {
        const parsed = JSON.parse(fullResponse)
        if (parsed && parsed.action === 'snapshot') {
          const snapshotResult = await requestSnapshotFromBackground()
          const composite = {
            ai: fullResponse,
            snapshot: snapshotResult
          }
          this.addMessage('assistant', JSON.stringify(composite))
          yield JSON.stringify(composite)
          return
        }
      } catch (e) {
        // ignore parse errors
      }

      this.addMessage('assistant', fullResponse)
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`
      this.addMessage('assistant', errorMessage)
      yield errorMessage
    }
  }

  private async callAI(systemPrompt: string): Promise<{ content: string }> {
    if (!this.config) {
      throw new Error('AI configuration not set')
    }

    try {
      const messages = this.getMessages().map(msg => ({
        role: msg.role === 'system' ? 'system' as const : msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }))

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10)
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      return { content: data.choices?.[0]?.message?.content || '' }
    } catch (error) {
      console.error('[AI Assistant] Error calling AI:', error)
      return { content: `Error: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  private async *callAIStream(systemPrompt: string): AsyncGenerator<string> {
    if (!this.config) {
      throw new Error('AI configuration not set')
    }

    try {
      const messages = this.getMessages().map(msg => ({
        role: msg.role === 'system' ? 'system' as const : msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }))

      const requestPayload = {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10)
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      }

      console.log('[AI Assistant] Request payload:', JSON.stringify(requestPayload, null, 2))

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[AI Assistant] API error:', response.status, errorText)
        yield `Error: AI API returned ${response.status} - ${errorText.substring(0, 200)}`
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                console.log('[AI Assistant] Received chunk:', content.substring(0, 50))
                yield content
              }
            } catch (e) {
              console.error('[AI Assistant] Error parsing SSE data:', e, 'Data:', data.substring(0, 100))
            }
          }
        }
      }
    } catch (error) {
      console.error('[AI Assistant] Error in streaming call:', error)
      yield `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  private addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    const message: AIMessage = {
      id: `msg_${Date.now()}`,
      role,
      content,
      timestamp: Date.now()
    }

    this.messages.push(message)

    if (this.messages.length > 20) {
      this.messages = this.messages.slice(-10)
    }
  }

  getMessages(): AIMessage[] {
    return this.messages
  }

  clearMessages(): void {
    this.messages = []
  }

  exportMarkdown(): string {
    let markdown = '# Browser Automation Chat\n\n'

    markdown += '---\n\n'
    markdown += `Exported: ${new Date().toISOString()}\n\n`
    markdown += '---\n\n'

    for (const msg of this.messages) {
      const timestamp = new Date(msg.timestamp).toLocaleString()
      const role = msg.role === 'user' ? '👤' : '🤖'

      markdown += `## ${role} *${timestamp}*\n\n`
      markdown += `${msg.content}\n\n`
      markdown += '---\n\n'
    }

    return markdown
  }
}

let globalAssistant: AIAssistant | null = null

export function getAssistant(): AIAssistant {
  if (!globalAssistant) {
    globalAssistant = new AIAssistant()
  }
  return globalAssistant
}

export function setAssistantConfig(config: AIConfig): void {
  getAssistant().setConfig(config)
}

// Helper to request an ARIA snapshot from the extension background/content script
export async function requestSnapshotFromBackground(): Promise<{ url?: string; title?: string; snapshot?: string; success?: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ success: false, error: 'Chrome runtime not available' })
        return
      }

      chrome.runtime.sendMessage({ type: 'AUTOMATION_ACTION', action: 'snapshot', payload: {} }, (response: any) => {
        if (!response) {
          resolve({ success: false, error: 'No response from background' })
          return
        }
        resolve(response.data || { success: false, error: 'No snapshot data' })
      })
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}
