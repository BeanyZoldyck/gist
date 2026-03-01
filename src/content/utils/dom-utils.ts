export type InputFieldInfo = {
  type: string
  name: string
  id: string
  placeholder: string
  ariaLabel: string
  value: string
  tagName: string
}

export function isTextInput(element: EventTarget | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element) return false
  if (!(element instanceof HTMLElement)) return false

  const tagName = element.tagName.toLowerCase()
  
  if (tagName === 'textarea') return true
  
  if (tagName === 'input') {
    const input = element as HTMLInputElement
    const type = input.type.toLowerCase()
    return ['text', 'password', 'email', 'search', 'url', 'tel'].includes(type)
  }
  
  return false
}

export function getInputInfo(element: HTMLInputElement | HTMLTextAreaElement): InputFieldInfo {
  return {
    type: element instanceof HTMLInputElement ? element.type : 'textarea',
    name: element.name || '',
    id: element.id || '',
    placeholder: element.placeholder || '',
    ariaLabel: element.getAttribute('aria-label') || '',
    value: element.value || '',
    tagName: element.tagName.toLowerCase()
  }
}

export function getElementPosition(element: HTMLElement): {
  top: number
  left: number
  width: number
  height: number
} {
  const rect = element.getBoundingClientRect()
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
  
  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
    width: rect.width,
    height: rect.height
  }
}

export function getPageDescription(): string | undefined {
  const metaTag = document.querySelector('meta[name="description"]')
  return metaTag?.getAttribute('content')?.trim() || undefined
}

export function extractLinkContext(element: HTMLElement, maxChars: number = 300): string | undefined {
  const parent = element.parentElement
  if (!parent) return undefined
  
  const parentText = parent.textContent?.trim() || ''
  const elementText = element.textContent?.trim() || ''
  
  if (parentText === elementText) return undefined
  
  const textIndex = parentText.indexOf(elementText)
  if (textIndex === -1) return undefined
  
  const contextChars = Math.floor(maxChars / 2)
  const beforeText = parentText.slice(Math.max(0, textIndex - contextChars), textIndex)
  const afterText = parentText.slice(textIndex + elementText.length, textIndex + elementText.length + contextChars)
  
  const context = `${beforeText.trim()} [LINK] ${afterText.trim()}`
  return context.length > maxChars ? context.substring(0, maxChars) + '...' : context
}
