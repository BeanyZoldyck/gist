export interface LinkHint {
  element: HTMLElement
  rect: DOMRect
  text: string
  href?: string
  index: number
}

export function isClickableElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false
  
  const tagName = element.tagName.toLowerCase()
  
  if (element.getAttribute('aria-disabled')?.toLowerCase() === 'true') return false
  
  if (element.hasAttribute('onclick')) return true
  
  const role = element.getAttribute('role')
  const clickableRoles = ['button', 'tab', 'link', 'checkbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'radio', 'textbox']
  if (role && clickableRoles.includes(role.toLowerCase())) return true
  
  const contentEditable = element.getAttribute('contentEditable')
  if (contentEditable && ['', 'contenteditable', 'true'].includes(contentEditable.toLowerCase())) return true
  
  switch (tagName) {
    case 'a':
      return true
    case 'textarea':
      const textarea = element as HTMLTextAreaElement
      return !textarea.disabled && !textarea.readOnly
    case 'input':
      const input = element as HTMLInputElement
      const type = input.type?.toLowerCase()
      return type !== 'hidden' && !input.disabled && !(input.readOnly && input.tabIndex >= 0)
    case 'button':
    case 'select':
      const btnOrSelect = element as HTMLButtonElement | HTMLSelectElement
      return !btnOrSelect.disabled
    case 'object':
    case 'embed':
      return true
    case 'details':
      return true
    case 'label':
      const label = element as HTMLLabelElement
      const control = label.control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      return control != null && !control.disabled
  }
  
  const tabIndex = element.getAttribute('tabindex')
  if (tabIndex && parseInt(tabIndex) >= 0) return true
  
  const className = element.getAttribute('class')?.toLowerCase()
  if (className?.includes('button')) return true
  
  if (tagName === 'div' || tagName === 'ol' || tagName === 'ul') {
    return element.clientHeight < element.scrollHeight
  }
  
  return false
}

export function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  
  if (rect.width === 0 || rect.height === 0) return false
  
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  
  return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0
}

export function getLinkHints(): LinkHint[] {
  const hints: LinkHint[] = []
  const allElements = document.querySelectorAll('*')
  const seenElements = new WeakSet<Element>()
  
  let index = 0
  for (const element of allElements) {
    if (!(element instanceof HTMLElement)) continue
    if (seenElements.has(element)) continue
    
    if (!isClickableElement(element)) continue
    if (!isVisible(element)) continue
    
    seenElements.add(element)
    
    const rect = element.getBoundingClientRect()
    const text = element.textContent?.trim() || ''
    const href = (element as HTMLAnchorElement).href || undefined
    
    hints.push({
      element,
      rect,
      text,
      href,
      index: index++
    })
  }
  
  return hints
}

export function getElementAtPoint(x: number, y: number): Element | null {
  return document.elementFromPoint(x, y)
}
