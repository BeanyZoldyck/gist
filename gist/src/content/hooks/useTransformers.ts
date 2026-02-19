import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

let generator: any = null
let isModelLoading = false

export async function loadModel() {
  if (generator || isModelLoading) {
    return generator
  }

  isModelLoading = true
  
  try {
    console.log('[Transformers] Loading model...')
    generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          console.log(`[Transformers] Loading: ${Math.round(progress.progress * 100)}%`)
        }
      }
    })
    console.log('[Transformers] Model loaded successfully!')
    return generator
  } catch (error) {
    console.error('[Transformers] Error loading model:', error)
    throw error
  } finally {
    isModelLoading = false
  }
}

export async function generateSuggestions(
  input: string,
  fieldType: string,
  maxSuggestions: number = 4
): Promise<string[]> {
  if (!input.trim()) {
    return getDefaultSuggestions(fieldType)
  }

  try {
    if (!generator) {
      await loadModel()
    }

    const prompts = getPromptsForFieldType(input, fieldType)
    const suggestions: string[] = []

    for (const prompt of prompts) {
      if (suggestions.length >= maxSuggestions) break

      try {
        const output = await generator(prompt, {
          max_new_tokens: 20,
          temperature: 0.7,
          do_sample: true,
          num_return_sequences: 1,
          truncation: true
        })

        const generatedText = output[0]?.generated_text || ''
        const suggestion = extractSuggestion(generatedText, prompt)
        
        if (suggestion && suggestion !== input && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion)
        }
      } catch (error) {
        console.error('[Transformers] Error generating suggestion:', error)
      }
    }

    if (suggestions.length === 0) {
      return getDefaultSuggestions(fieldType)
    }

    return suggestions
  } catch (error) {
    console.error('[Transformers] Generation error:', error)
    return getDefaultSuggestions(fieldType)
  }
}

function getPromptsForFieldType(input: string, fieldType: string): string[] {
  const lowerType = fieldType.toLowerCase()
  
  if (lowerType.includes('email')) {
    return [
      `Complete this email: ${input}`,
      `Suggest an email: ${input}`
    ]
  }
  
  if (lowerType.includes('pass')) {
    return [
      input.length > 0 ? `Complete password: ${input}` : 'Generate a secure password'
    ]
  }
  
  if (lowerType.includes('user') || lowerType.includes('name')) {
    return [
      `Complete username: ${input}`,
      `Suggest username: ${input}`
    ]
  }
  
  if (lowerType.includes('search')) {
    return [
      `Complete search query: ${input}`,
      `Related search: ${input}`
    ]
  }
  
  if (lowerType.includes('url')) {
    return [
      `Complete URL: ${input}`,
      `Suggest website: ${input}`
    ]
  }

  return [
    `Complete text: ${input}`,
    `Suggest completion: ${input}`
  ]
}

function extractSuggestion(generated: string, prompt: string): string {
  const cleanText = generated.replace(prompt, '').trim()
  const firstLine = cleanText.split('\n')[0].split(',')[0].split('.')[0]
  return firstLine.trim()
}

function getDefaultSuggestions(fieldType: string): string[] {
  const lowerType = fieldType.toLowerCase()
  
  if (lowerType.includes('email')) {
    return ['test@example.com', 'user@domain.com', 'admin@company.org', 'support@test.com']
  }
  if (lowerType.includes('user') || lowerType.includes('name')) {
    return ['john_doe', 'jane_smith', 'user123', 'admin', 'tester']
  }
  if (lowerType.includes('pass')) {
    return ['Password123!', 'SecurePass@2024', 'MyP@ssw0rd', 'Temp#1234']
  }
  if (lowerType.includes('search')) {
    return ['how to write code', 'best practices', 'tutorial guide', 'documentation']
  }
  if (lowerType.includes('url')) {
    return ['https://example.com', 'https://google.com', 'https://github.com']
  }

  return ['Suggestion 1', 'Suggestion 2', 'Suggestion 3', 'Suggestion 4']
}

export { generator }
