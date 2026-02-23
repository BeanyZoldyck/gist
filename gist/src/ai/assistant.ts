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

Provide clear instructions in plain text about what to do.

${pageContext}

Provide your response in the format:
Action: <action_name>
Parameters: <json_parameters>

For example:
Action: snapshot
Parameters: {}

Action: click
Parameters: { "element": "Submit" }

Respond with your action or ask questions if you need more information.

IMPORTANT: If you need more context, ask for a snapshot first using the "Capture Snapshot" button.

Don't include any other text or explanations.`

    const response = await this.callAI(systemPrompt)

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

Provide clear instructions in plain text about what to do.

${pageContext}

Provide your response in the format:
Action: <action_name>
Parameters: <json_parameters>

For example:
Action: snapshot
Parameters: {}

Action: click
Parameters: { "element": "Submit" }

Respond with your action or ask questions if you need more information.

IMPORTANT: If you need more context, ask for a snapshot first using the "Capture Snapshot" button.

Don't include any other text or explanations.`

    let fullResponse = ''
    try {
      const stream = await this.callAIStream(systemPrompt)
      for await (const chunk of stream) {
        fullResponse += chunk
        yield chunk
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

      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
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
          max_tokens: 500
        })
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`)
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

      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
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
          max_tokens: 500,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`)
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
                yield content
              }
            } catch (e) {
              console.error('[AI Assistant] Error parsing SSE data:', e)
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
