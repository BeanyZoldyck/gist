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

function hasMeaningfulText(element: HTMLElement): boolean {
  const text = element.textContent?.trim() || ''
  const ariaLabel = element.getAttribute('aria-label')?.trim() || ''
  
  return text.length > 0 || ariaLabel.length > 0
}

function hasMeaningfulContent(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  
  if (tagName === 'a') {
    return true
  }
  
  if (tagName === 'button') {
    return true
  }
  
  if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
    return true
  }
  
  if (element.hasAttribute('role')) {
    return true
  }
  
  return hasMeaningfulText(element)
}

function checkOverlap(rect1: DOMRect, rect2: DOMRect): boolean {
  const overlapX = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left))
  const overlapY = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top))
  const overlapArea = overlapX * overlapY
  const area1 = (rect1.right - rect1.left) * (rect1.bottom - rect1.top)
  const area2 = (rect2.right - rect2.left) * (rect2.bottom - rect2.top)
  
  const minArea = Math.min(area1, area2)
  return overlapArea > minArea * 0.7
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
    if (!hasMeaningfulContent(element)) continue
    
    const rect = element.getBoundingClientRect()
    
    if (rect.width < 5 || rect.height < 5) continue
    
    seenElements.add(element)
    
    const text = element.textContent?.trim().substring(0, 100) || ''
    const href = (element as HTMLAnchorElement).href || undefined
    
    hints.push({
      element,
      rect,
      text,
      href,
      index: index++
    })
  }
  
  const filteredHints: LinkHint[] = []
  const usedPositions = new Set<string>()
  
  for (const hint of hints) {
    const rect = hint.rect
    const positionKey = `${Math.round(rect.left)}-${Math.round(rect.top)}`
    
    if (usedPositions.has(positionKey)) {
      continue
    }
    
    let overlapping = false
    for (const existingHint of filteredHints) {
      if (checkOverlap(rect, existingHint.rect)) {
        if (hint.element.contains(existingHint.element)) {
          continue
        }
        if (existingHint.element.contains(hint.element)) {
          filteredHints.splice(filteredHints.indexOf(existingHint), 1)
          usedPositions.delete(`${Math.round(existingHint.rect.left)}-${Math.round(existingHint.rect.top)}`)
          break
        }
        overlapping = true
        break
      }
    }
    
    if (!overlapping) {
      filteredHints.push(hint)
      usedPositions.add(positionKey)
    }
  }
  
  return filteredHints
}

export function getElementAtPoint(x: number, y: number): Element | null {
  return document.elementFromPoint(x, y)
}
