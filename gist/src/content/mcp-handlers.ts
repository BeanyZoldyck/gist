import { generateAriaSnapshot, findElementByIndex, findElementByText } from './utils/aria-snapshot'
import { isClickableElement } from './utils/link-hints'

window.addEventListener('error', (event) => {
  if (event.message?.includes('Extension context invalidated') || event.message?.includes('The message port closed')) {
    event.preventDefault()
    event.stopPropagation()
    console.warn('[MCP Handlers] Extension context invalidated. Reload the page to restore full functionality.')
  }
})

let isInitialized = false

function initializeMcpHandlers() {
  if (isInitialized) return
  isInitialized = true

  console.log('[MCP Handlers] Initializing...')

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'MCP_ACTION') return

    console.log('[MCP Handlers] Received action:', message.action, message.payload)

    handleMcpAction(message.action, message.payload, sender.tab?.id)
      .then(result => {
        console.log('[MCP Handlers] Action result:', result)
        sendResponse({ success: true, data: result })
      })
      .catch(error => {
        console.error('[MCP Handlers] Action error:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true
  })
}

async function handleMcpAction(action: string, payload: any, _tabId?: number) {
  switch (action) {
    case 'browser_snapshot':
      return handleSnapshot()
    case 'browser_click':
      return handleClick(payload)
    case 'browser_hover':
      return handleHover(payload)
    case 'browser_type':
      return handleType(payload)
    case 'browser_select_option':
      return handleSelectOption(payload)
    case 'browser_drag':
      return handleDrag(payload)
    case 'getUrl':
      return handleGetUrl()
    case 'getTitle':
      return handleGetTitle()
    case 'browser_press_key':
      return handlePressKey(payload)
    case 'browser_wait':
      return handleWait(payload)
    case 'getConsoleLogs':
      return handleGetConsoleLogs()
    case 'screenshot':
      return handleScreenshot()
    default:
      throw new Error(`Unknown MCP action: ${action}`)
  }
}

function handleSnapshot(): string {
  return generateAriaSnapshot()
}

function handleClick(payload: { element?: string; ref?: string; text?: string }): string {
  let element: Element | null = null

  if (payload.ref) {
    element = findElementByIndex(parseInt(payload.ref))
  } else if (payload.element) {
    element = findElementByText(payload.element)
  }

  if (!element) {
    throw new Error(`Element not found: ${payload.element || payload.ref}`)
  }

  if (!isClickableElement(element)) {
    throw new Error(`Element is not clickable: ${payload.element || payload.ref}`)
  }

  (element as HTMLElement).click()

  return `Clicked element: ${payload.element || payload.ref}`
}

function handleHover(payload: { element?: string; ref?: string; text?: string }): string {
  let element: Element | null = null

  if (payload.ref) {
    element = findElementByIndex(parseInt(payload.ref))
  } else if (payload.element) {
    element = findElementByText(payload.element)
  }

  if (!element) {
    throw new Error(`Element not found: ${payload.element || payload.ref}`)
  }

  const hoverEvent = new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window })
  element.dispatchEvent(hoverEvent)

  return `Hovered over element: ${payload.element || payload.ref}`
}

function handleType(payload: { element?: string; ref?: string; text: string; submit?: boolean }): string {
  let element: Element | null = null

  if (payload.ref) {
    element = findElementByIndex(parseInt(payload.ref))
  } else if (payload.element) {
    element = findElementByText(payload.element)
  }

  if (!element) {
    throw new Error(`Element not found: ${payload.element || payload.ref}`)
  }

  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error(`Element is not an input: ${payload.element || payload.ref}`)
  }

  element.focus()
  element.value = payload.text
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))

  if (payload.submit) {
    const form = (element as HTMLInputElement).form
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }
  }

  return `Typed "${payload.text}" into element: ${payload.element || payload.ref}`
}

function handleSelectOption(payload: { element?: string; ref?: string; values: string[] }): string {
  let element: Element | null = null

  if (payload.ref) {
    element = findElementByIndex(parseInt(payload.ref))
  } else if (payload.element) {
    element = findElementByText(payload.element)
  }

  if (!element) {
    throw new Error(`Element not found: ${payload.element || payload.ref}`)
  }

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Element is not a select: ${payload.element || payload.ref}`)
  }

  const options = Array.from(element.options)
  for (const value of payload.values) {
    const option = options.find(opt => opt.value === value || opt.textContent?.includes(value))
    if (option) {
      option.selected = true
    }
  }

  element.dispatchEvent(new Event('change', { bubbles: true }))

  return `Selected options in element: ${payload.element || payload.ref}`
}

function handleDrag(payload: { startElement?: string; startRef?: string; endElement?: string; endRef?: string }): string {
  let startElement: Element | null = null
  let endElement: Element | null = null

  if (payload.startRef) {
    startElement = findElementByIndex(parseInt(payload.startRef))
  } else if (payload.startElement) {
    startElement = findElementByText(payload.startElement)
  }

  if (payload.endRef) {
    endElement = findElementByIndex(parseInt(payload.endRef))
  } else if (payload.endElement) {
    endElement = findElementByText(payload.endElement)
  }

  if (!startElement || !endElement) {
    throw new Error(`Elements not found for drag operation`)
  }

  if (!(startElement instanceof HTMLElement) || !(endElement instanceof HTMLElement)) {
    throw new Error(`Elements are not valid for drag operation`)
  }

  const startRect = startElement.getBoundingClientRect()
  const endRect = endElement.getBoundingClientRect()

  const startX = startRect.left + startRect.width / 2
  const startY = startRect.top + startRect.height / 2
  const endX = endRect.left + endRect.width / 2
  const endY = endRect.top + endRect.height / 2

  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: startX,
    clientY: startY,
    buttons: 1
  })
  startElement.dispatchEvent(mouseDownEvent)

  const mouseMoveEvent = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: endX,
    clientY: endY,
    buttons: 1
  })
  endElement.dispatchEvent(mouseMoveEvent)

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: endX,
    clientY: endY
  })
  endElement.dispatchEvent(mouseUpEvent)

  return `Dragged from ${payload.startElement || payload.startRef} to ${payload.endElement || payload.endRef}`
}

function handleGetUrl(): string {
  return window.location.href
}

function handleGetTitle(): string {
  return document.title
}

function handlePressKey(payload: { key: string }): string {
  const keyEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: payload.key
  })
  document.activeElement?.dispatchEvent(keyEvent)

  const keyUpEvent = new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: payload.key
  })
  document.activeElement?.dispatchEvent(keyUpEvent)

  return `Pressed key: ${payload.key}`
}

async function handleWait(payload: { time: number }): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, payload.time * 1000))
  return `Waited for ${payload.time} seconds`
}

function handleGetConsoleLogs(): any[] {
  const logs = (window as any).browserMcpConsoleLogs || []
  return logs.slice(-50)
}

function handleScreenshot(): string {
  throw new Error('Screenshot not yet implemented in content script')
}

initializeMcpHandlers()

console.log('[MCP Handlers] Ready')
