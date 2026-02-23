import { searchResources as searchQdrant } from './qdrant-content-client'
import { searchResources as searchIndexedDB, Resource } from './resource-storage'

export interface CompletionState {
  activeElement: HTMLElement | null
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

  activateCompletion(element: HTMLElement): CompletionState {
    this.state.activeElement = element

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.state.cursorPosition = element.selectionStart || 0
    } else if (element.isContentEditable) {
      this.state.cursorPosition = getContentEditableCursorPosition(element)
    } else {
      this.state.cursorPosition = 0
    }

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

  getActiveElement(): HTMLElement | null {
    return this.state.activeElement
  }

  getQuery(): string {
    if (!this.state.activeElement) return ''

    const element = this.state.activeElement

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const cursorPosition = this.state.cursorPosition
      const selectionEnd = element.selectionEnd || element.value.length

      this.state.query = element.value.substring(cursorPosition, selectionEnd)
      return this.state.query
    } else if (element.isContentEditable) {
      return this.state.query = getContentEditableQuery(element, this.state.cursorPosition)
    }

    return ''
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

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const cursorPosition = this.state.cursorPosition
      const query = this.state.query

      const currentValue = element.value
      const newValue = currentValue.substring(0, cursorPosition) + url + currentValue.substring(cursorPosition + query.length)

      element.value = newValue
      element.focus()
      element.setSelectionRange(cursorPosition + url.length, cursorPosition + url.length)

      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (element.isContentEditable) {
      replaceContentEditableText(element, this.state.cursorPosition, this.state.query, url)
    }
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

function getContentEditableCursorPosition(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.endContainer, range.endOffset)

  return preCaretRange.toString().length
}

function getContentEditableQuery(element: HTMLElement, cursorPosition: number): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return ''

  const range = selection.getRangeAt(0)
  const startOffset = range.startOffset
  const endOffset = range.endOffset

  const textContent = element.innerText || element.textContent || ''

  if (startOffset === endOffset) {
    return textContent.substring(cursorPosition)
  }

  return textContent.substring(startOffset, endOffset)
}

function replaceContentEditableText(element: HTMLElement, cursorPosition: number, query: string, url: string): void {
  const textContent = element.innerText || element.textContent || ''
  const newContent = textContent.substring(0, cursorPosition) + url + textContent.substring(cursorPosition + query.length)

  element.innerText = newContent

  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    const textNode = element.firstChild

    if (textNode) {
      const nodeValue = (textNode as Text).nodeValue || ''
      const newCursorPos = cursorPosition + url.length
      range.setStart(textNode, Math.min(newCursorPos, nodeValue.length))
      range.setEnd(textNode, Math.min(newCursorPos, nodeValue.length))
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  element.dispatchEvent(new Event('input', { bubbles: true }))
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
