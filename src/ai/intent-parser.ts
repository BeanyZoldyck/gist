export interface ParsedIntent {
  action: string
  parameters: Record<string, any>
  confidence: number
  rawCommand: string
}

export interface IntentPattern {
  action: string
  patterns: RegExp[]
  parameterExtractor: (match: RegExpMatchArray) => Record<string, any>
}

export class IntentParser {
  private patterns: IntentPattern[] = [
    {
      action: 'navigate',
      patterns: [
        /(?:go to|navigate|open|visit)\s+(?:the\s+)?(?:page|site|website)?\s*["']?([^"']+)["']?/i,
        /(?:browse to|load)\s+(?:https?:\/\/)?([^\s]+)/i
      ],
      parameterExtractor: (match) => {
        let url = match[1]?.trim()
        if (url && !url.startsWith('http')) {
          url = `https://${url}`
        }
        return { url }
      }
    },
    {
      action: 'click',
      patterns: [
        /(?:click|tap|select|press)\s+(?:on\s+)?(?:the\s+)?(?:button|link|element|tab)?\s*["']?([^"']+?)["']?/i,
        /(?:click|tap)\s+["']?([^"']+)["']?/i
      ],
      parameterExtractor: (match) => {
        const element = match[1]?.trim()
        return { element }
      }
    },
    {
      action: 'type',
      patterns: [
        /(?:type|enter|input)\s+(?:"([^"]+)"|'([^']+)'|([^\s]+(?:\s+[^\s]+)*?))\s+(?:into|in|to)\s+(?:the\s+)?(?:input|field|box|textarea)?\s*["']?([^"']*)["']?/i,
        /(?:type|enter|input)\s+(?:"([^"]+)"|'([^']+)'|([^\s]+(?:\s+[^\s]+)*?))\s+["']?([^"']*)["']?/i
      ],
      parameterExtractor: (match) => {
        const text = match[1] || match[2] || match[3]
        const element = match[4]?.trim()
        return { text, ...(element && { element }) }
      }
    },
    {
      action: 'wait',
      patterns: [
        /(?:wait|pause|delay)\s+(?:for\s+)?(\d+)\s*(?:seconds?|secs?|s)/i,
        /(?:wait|pause)\s+(\d+)\s*(?:seconds?|secs?|s)/i
      ],
      parameterExtractor: (match) => {
        const time = parseInt(match[1], 10)
        return { time }
      }
    },
    {
      action: 'hover',
      patterns: [
        /(?:hover|mouse\s*over)\s+(?:over\s+)?(?:the\s+)?(?:element|button|link)?\s*["']?([^"']+?)["']?/i
      ],
      parameterExtractor: (match) => {
        const element = match[1]?.trim()
        return { element }
      }
    },
    {
      action: 'selectOption',
      patterns: [
        /(?:select|choose|pick)\s+(?:option\s+)["']?([^"']+)["']?\s+(?:from|in)\s+(?:the\s+)?(?:dropdown|select)?\s*["']?([^"']*)["']?/i,
        /(?:select|choose|pick)\s+(?:the\s+)?(?:option\s+)?["']?([^"']+)["']?/i
      ],
      parameterExtractor: (match) => {
        const values = [match[1]?.trim()]
        const element = match[2]?.trim()
        return { values, ...(element && { element }) }
      }
    },
    {
      action: 'drag',
      patterns: [
        /(?:drag)\s+(?:from\s+)?["']?([^"']+?)["']?\s+to\s+["']?([^"']+?)["']?/i
      ],
      parameterExtractor: (match) => {
        const startElement = match[1]?.trim()
        const endElement = match[2]?.trim()
        return { startElement, endElement }
      }
    },
    {
      action: 'pressKey',
      patterns: [
        /(?:press|hit)\s+(?:the\s+)?(?:key\s+)?["']?([^"']+)["']?/i
      ],
      parameterExtractor: (match) => {
        const key = match[1]?.trim()
        return { key }
      }
    },
    {
      action: 'goBack',
      patterns: [
        /(?:go\s+back|back|previous)/i
      ],
      parameterExtractor: () => ({})
    },
    {
      action: 'goForward',
      patterns: [
        /(?:go\s+forward|forward|next)/i
      ],
      parameterExtractor: () => ({})
    },
    {
      action: 'snapshot',
      patterns: [
        /(?:take\s+)?(?:a\s+)?(?:snapshot|screenshot|capture)\s*(?:of\s+(?:the\s+)?(?:page|screen))?/i
      ],
      parameterExtractor: () => ({})
    }
  ]

  parse(command: string): ParsedIntent | null {
    const trimmedCommand = command.trim()

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = trimmedCommand.match(regex)
        if (match) {
          const parameters = pattern.parameterExtractor(match)
          const confidence = this.calculateConfidence(match, trimmedCommand)

          return {
            action: pattern.action,
            parameters,
            confidence,
            rawCommand: trimmedCommand
          }
        }
      }
    }

    return null
  }

  private calculateConfidence(match: RegExpMatchArray, command: string): number {
    const matchedText = match[0]
    const matchRatio = matchedText.length / command.length

    let confidence = matchRatio

    if (command.toLowerCase().startsWith(matchedText.toLowerCase())) {
      confidence += 0.1
    }

    if (confidence > 1) confidence = 1

    return confidence
  }

  getSuggestions(command: string): ParsedIntent[] {
    const trimmedCommand = command.trim().toLowerCase()
    const suggestions: ParsedIntent[] = []

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = trimmedCommand.match(regex)
        if (match) {
          const parameters = pattern.parameterExtractor(match)
          const confidence = this.calculateConfidence(match, trimmedCommand)

          suggestions.push({
            action: pattern.action,
            parameters,
            confidence,
            rawCommand: command.trim()
          })
        }
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }
}

export const intentParser = new IntentParser()
