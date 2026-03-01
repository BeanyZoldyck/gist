interface SnapshotNode {
  index: number
  role?: string
  name?: string
  description?: string
  value?: string
  checked?: boolean
  selected?: boolean
  disabled?: boolean
  href?: string
  tagName?: string
  children?: SnapshotNode[]
}

let elementIndex = 0
let elementIndexMap = new WeakMap<Element, number>()

function getElementIndex(element: Element): number {
  if (!elementIndexMap.has(element)) {
    elementIndexMap.set(element, ++elementIndex)
  }
  return elementIndexMap.get(element) || 0
}

function getAccessibleName(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  const ariaLabelledby = element.getAttribute('aria-labelledby')
  if (ariaLabelledby) {
    const labelElement = document.getElementById(ariaLabelledby)
    if (labelElement) return labelElement.textContent?.trim() || ''
  }

  const id = element.id
  if (id) {
    const labelElement = document.querySelector(`label[for="${id}"]`)
    if (labelElement) return labelElement.textContent?.trim() || ''
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.placeholder || element.name || ''
  }

  const textContent = element.textContent?.trim()
  if (textContent && textContent.length < 50) return textContent

  return ''
}

function getAccessibleDescription(element: Element): string {
  const ariaDescribedby = element.getAttribute('aria-describedby')
  if (ariaDescribedby) {
    const descElements = ariaDescribedby.split(' ').map(id => document.getElementById(id)).filter(Boolean)
    return descElements.map(e => e?.textContent?.trim()).filter(Boolean).join(' ') || ''
  }

  return ''
}

function isInteractive(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false

  const role = element.getAttribute('role')
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'listbox', 'option', 'tab', 'menuitem', 'slider', 'switch']
  if (role && interactiveRoles.includes(role.toLowerCase())) return true

  const tagName = element.tagName.toLowerCase()
  switch (tagName) {
    case 'a':
      return true
    case 'input':
      return (element as HTMLInputElement).type !== 'hidden'
    case 'button':
    case 'textarea':
    case 'select':
      return true
  }

  if (element.getAttribute('contenteditable') === 'true') return true

  return false
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false

  return true
}

function captureElement(element: Element, depth: number = 0, maxDepth: number = 10): SnapshotNode | null {
  if (depth > maxDepth) return null

  if (!isVisible(element)) return null

  const node: SnapshotNode = {
    index: getElementIndex(element)
  }

  const role = element.getAttribute('role')
  const tagName = element.tagName.toLowerCase()

  if (role) {
    node.role = role
  } else {
    switch (tagName) {
      case 'a':
        node.role = 'link'
        node.href = (element as HTMLAnchorElement).href
        break
      case 'button':
        node.role = 'button'
        break
      case 'input':
        const inputType = (element as HTMLInputElement).type
        node.role = inputType === 'checkbox' || inputType === 'radio' ? inputType : 'textbox'
        node.value = (element as HTMLInputElement).value || undefined
        node.checked = (element as HTMLInputElement).checked || undefined
        break
      case 'textarea':
        node.role = 'textbox'
        node.value = (element as HTMLTextAreaElement).value || undefined
        break
      case 'select':
        node.role = 'combobox'
        break
      case 'option':
        node.role = 'option'
        node.selected = (element as HTMLOptionElement).selected || undefined
        break
    }
  }

  const name = getAccessibleName(element)
  if (name) node.name = name

  const description = getAccessibleDescription(element)
  if (description) node.description = description

  if (element.getAttribute('aria-disabled') === 'true' || 
      (element instanceof HTMLInputElement && element.disabled) ||
      (element instanceof HTMLButtonElement && element.disabled)) {
    node.disabled = true
  }

  if (tagName === 'input' || tagName === 'textarea') {
    node.value = (element as HTMLInputElement | HTMLTextAreaElement).value || undefined
  }

  const children: SnapshotNode[] = []
  for (const child of element.children) {
    if (isInteractive(child)) {
      const childNode = captureElement(child, depth + 1, maxDepth)
      if (childNode) children.push(childNode)
    }
  }

  if (children.length > 0) {
    node.children = children
  }

  return node
}

function nodeToYaml(node: SnapshotNode, indent: number = 0): string {
  const prefix = '  '.repeat(indent)
  let lines: string[] = []

  const attrs: string[] = []
  attrs.push(`index: ${node.index}`)
  if (node.role) attrs.push(`role: ${node.role}`)
  if (node.name) attrs.push(`name: "${escapeYaml(node.name)}"`)
  if (node.description) attrs.push(`description: "${escapeYaml(node.description)}"`)
  if (node.value) attrs.push(`value: "${escapeYaml(node.value)}"`)
  if (node.checked !== undefined) attrs.push(`checked: ${node.checked}`)
  if (node.selected !== undefined) attrs.push(`selected: ${node.selected}`)
  if (node.disabled) attrs.push(`disabled: true`)
  if (node.href) attrs.push(`href: "${escapeYaml(node.href)}"`)
  if (node.tagName) attrs.push(`tagName: ${node.tagName}`)

  lines.push(`${prefix}- ${attrs.join(' ')}`)

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      lines.push(nodeToYaml(child, indent + 1))
    }
  }

  return lines.join('\n')
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
}

export function generateAriaSnapshot(): string {
  elementIndex = 0
  elementIndexMap = new WeakMap()

  const interactiveElements = Array.from(document.querySelectorAll('*')).filter(isInteractive).filter(isVisible)
  
  const rootNodes: SnapshotNode[] = []
  const processed = new WeakSet<Element>()

  for (const element of interactiveElements) {
    if (processed.has(element)) continue

    const rootElement = element.parentElement
    if (rootElement && isInteractive(rootElement) && isVisible(rootElement)) {
      continue
    }

    const node = captureElement(element)
    if (node) {
      rootNodes.push(node)
      processed.add(element)
      markDescendants(element, processed)
    }
  }

  if (rootNodes.length === 0) {
    return 'No interactive elements found'
  }

  return rootNodes.map(node => nodeToYaml(node)).join('\n')
}

function markDescendants(element: Element, processed: WeakSet<Element>) {
  for (const child of element.children) {
    if (isInteractive(child)) {
      processed.add(child)
    }
    markDescendants(child, processed)
  }
}

export function findElementByIndex(index: number): Element | null {
  const interactiveElements = Array.from(document.querySelectorAll('*')).filter(isInteractive).filter(isVisible)
  for (const element of interactiveElements) {
    if (getElementIndex(element) === index) {
      return element
    }
  }
  return null
}

export function findElementByText(text: string): Element | null {
  const interactiveElements = Array.from(document.querySelectorAll('*')).filter(isInteractive).filter(isVisible)
  const lowerText = text.toLowerCase()

  for (const element of interactiveElements) {
    const name = getAccessibleName(element)
    const elementText = element.textContent?.trim() || ''

    if (name.toLowerCase().includes(lowerText) || elementText.toLowerCase().includes(lowerText)) {
      return element
    }
  }
  return null
}
