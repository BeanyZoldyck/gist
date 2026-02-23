import { searchResources as searchQdrant } from './qdrant-content-client'
import { searchResources as searchIndexedDB, Resource } from './resource-storage'

export interface CompletionState {
  activeElement: HTMLInputElement | HTMLTextAreaElement | null
  cursorPosition: number
  visible: boolean
  query: string
}

export interface SearchResult {
  id: string
  url: string
  title: string
  score?: number
  notes?: string
  tags?: string[]
  createdAt?: number
}

interface CompletionManagerOptions {
  onResultsChange: (results: SearchResult[]) => void
  onClose: () => void
}

class CompletionManager {
  private state: CompletionState = {
    activeElement: null,
    cursorPosition: 0,
    visible: false,
    query: ''
  }

  private options: CompletionManagerOptions | null = null
  private inputHandler: (() => void) | null = null
  private debounceTimer: number | null = null

  setOptions(options: CompletionManagerOptions): void {
    this.options = options
  }

  activateCompletion(element: HTMLInputElement | HTMLTextAreaElement): CompletionState {
    this.state.activeElement = element
    this.state.cursorPosition = element.selectionStart || 0
    this.state.visible = true
    this.state.query = ''

    this.setupInputListener()

    return { ...this.state }
  }

  deactivateCompletion(): void {
    if (this.state.activeElement && this.inputHandler) {
      this.state.activeElement.removeEventListener('input', this.inputHandler)
    }
    this.inputHandler = null

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.state = {
      activeElement: null,
      cursorPosition: 0,
      visible: false,
      query: ''
    }
  }

  getActiveElement(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.state.activeElement
  }

  getQuery(): string {
    if (!this.state.activeElement) return ''
    
    const element = this.state.activeElement
    const cursorPosition = this.state.cursorPosition
    const selectionEnd = element.selectionEnd || element.value.length
    
    this.state.query = element.value.substring(cursorPosition, selectionEnd)
    return this.state.query
  }

  async searchCompletion(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []

    try {
      const qdrantResults = await searchQdrant(query, 3)
      if (qdrantResults.length > 0) {
        return qdrantResults
          .map(r => ({
            id: r.id,
            url: r.payload.url,
            title: r.payload.title,
            score: r.score,
            notes: r.payload.notes,
            tags: r.payload.tags,
            createdAt: r.payload.createdAt
          }))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 3)
      }
    } catch (error) {
      console.log('[Completion] Qdrant search failed, falling back to IndexedDB')
    }

    const indexedDbResources = await searchIndexedDB(query)
    return indexedDbResources
      .slice(0, 3)
      .map(r => ({
        id: r.id,
        url: r.url,
        title: r.title,
        notes: r.notes,
        tags: r.tags,
        createdAt: r.createdAt,
        score: calculateRelevanceScore(query, r)
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
  }

  replaceWithUrl(url: string): void {
    if (!this.state.activeElement) return

    const element = this.state.activeElement
    const cursorPosition = this.state.cursorPosition
    const query = this.state.query

    const currentValue = element.value
    const newValue = currentValue.substring(0, cursorPosition) + url + currentValue.substring(cursorPosition + query.length)

    element.value = newValue
    element.focus()
    element.setSelectionRange(cursorPosition + url.length, cursorPosition + url.length)

    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  private setupInputListener(): void {
    if (!this.state.activeElement) return

    const element = this.state.activeElement

    const debouncedSearch = () => {
      console.log('[CompletionManager] Input event on element, query:', this.getQuery())
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }
      this.debounceTimer = window.setTimeout(async () => {
        const query = this.getQuery()
        console.log('[CompletionManager] Debounced search for query:', query)
        if (this.options && query.length > 0) {
          try {
            const results = await this.searchCompletion(query)
            console.log('[CompletionManager] Search results:', results)
            this.options.onResultsChange(results)
          } catch (error) {
            console.error('[Completion] Search failed:', error)
            this.options.onResultsChange([])
          }
        } else if (this.options) {
          this.options.onResultsChange([])
        }
      }, 200)
    }

    this.inputHandler = debouncedSearch
    element.addEventListener('input', debouncedSearch)
  }
}

function calculateRelevanceScore(query: string, resource: Resource): number {
  const lowerQuery = query.toLowerCase()
  let score = 0

  if (resource.title.toLowerCase().includes(lowerQuery)) {
    score += 10
    if (resource.title.toLowerCase().startsWith(lowerQuery)) {
      score += 5
    }
  }

  if (resource.url.toLowerCase().includes(lowerQuery)) {
    score += 7
  }

  if (resource.notes.toLowerCase().includes(lowerQuery)) {
    score += 5
  }

  resource.tags.forEach(tag => {
    if (tag.toLowerCase().includes(lowerQuery)) {
      score += 3
    }
  })

  return score
}

export const completionManager = new CompletionManager()
