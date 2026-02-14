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
