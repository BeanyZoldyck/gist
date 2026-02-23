import { generateAriaSnapshot, findElementByIndex, findElementByText } from './utils/aria-snapshot'
import { isClickableElement } from './utils/link-hints'

console.log('[Browser Automation] Initializing automation controller...')

export interface AutomationResult {
  success: boolean
  data?: any
  error?: string
}

export interface SnapshotResult {
  url: string
  title: string
  snapshot: string
}

export interface ElementLocator {
  index?: number
  text?: string
  ref?: string
}

export interface ActionPayload {
  element?: string
  ref?: string
  text?: string
  value?: string
  values?: string[]
  startElement?: string
  startRef?: string
  endElement?: string
  endRef?: string
  url?: string
  key?: string
  time?: number
  submit?: boolean
}

class AutomationController {
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    if (this.isInitialized) return
    this.isInitialized = true

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type !== 'AUTOMATION_ACTION') return true

      console.log('[Browser Automation] Received action:', message.action)

      this.handleAction(message.action, message.payload)
        .then(result => {
          console.log('[Browser Automation] Action result:', result)
          sendResponse(result)
        })
        .catch(error => {
          console.error('[Browser Automation] Action error:', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        })

      return true
    })

    console.log('[Browser Automation] Controller initialized')
  }

  private async handleAction(action: string, payload: ActionPayload): Promise<AutomationResult> {
    try {
      switch (action) {
        case 'snapshot':
          return this.handleSnapshot()
        case 'navigate':
          return this.handleError('Navigation must be handled by background script')
        case 'goBack':
          return this.handleError('Navigation must be handled by background script')
        case 'goForward':
          return this.handleError('Navigation must be handled by background script')
        case 'click':
          return this.handleClick(payload)
        case 'hover':
          return this.handleHover(payload)
        case 'type':
          return this.handleType(payload)
        case 'selectOption':
          return this.handleSelectOption(payload)
        case 'drag':
          return this.handleDrag(payload)
        case 'pressKey':
          return this.handlePressKey(payload)
        case 'wait':
          return this.handleWait(payload)
        case 'getConsoleLogs':
          return this.handleGetConsoleLogs()
        case 'getUrl':
          return { success: true, data: window.location.href }
        case 'getTitle':
          return { success: true, data: document.title }
        default:
          return this.handleError(`Unknown action: ${action}`)
      }
    } catch (error) {
      return this.handleError(error instanceof Error ? error.message : String(error))
    }
  }

  private handleError(message: string): AutomationResult {
    return { success: false, error: message }
  }

  private handleSnapshot(): AutomationResult {
    const snapshot = generateAriaSnapshot()
    const result: SnapshotResult = {
      url: window.location.href,
      title: document.title,
      snapshot
    }
    return { success: true, data: result }
  }

  private handleClick(payload: ActionPayload): AutomationResult {
    let element: Element | null = null

    if (payload.ref) {
      element = findElementByIndex(parseInt(payload.ref))
    } else if (payload.element) {
      element = findElementByText(payload.element)
    }

    if (!element) {
      return this.handleError(`Element not found: ${payload.element || payload.ref}`)
    }

    if (!isClickableElement(element)) {
      return this.handleError(`Element is not clickable: ${payload.element || payload.ref}`)
    }

    (element as HTMLElement).click()

    return { success: true, data: `Clicked element: ${payload.element || payload.ref}` }
  }

  private handleHover(payload: ActionPayload): AutomationResult {
    let element: Element | null = null

    if (payload.ref) {
      element = findElementByIndex(parseInt(payload.ref))
    } else if (payload.element) {
      element = findElementByText(payload.element)
    }

    if (!element) {
      return this.handleError(`Element not found: ${payload.element || payload.ref}`)
    }

    const hoverEvent = new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window })
    element.dispatchEvent(hoverEvent)

    return { success: true, data: `Hovered over element: ${payload.element || payload.ref}` }
  }

  private handleType(payload: ActionPayload): AutomationResult {
    if (!payload.text) {
      return this.handleError('Text is required for type action')
    }

    let element: Element | null = null

    if (payload.ref) {
      element = findElementByIndex(parseInt(payload.ref))
    } else if (payload.element) {
      element = findElementByText(payload.element)
    }

    if (!element) {
      return this.handleError(`Element not found: ${payload.element || payload.ref}`)
    }

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return this.handleError(`Element is not an input: ${payload.element || payload.ref}`)
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

    return { success: true, data: `Typed "${payload.text}" into element: ${payload.element || payload.ref}` }
  }

  private handleSelectOption(payload: ActionPayload): AutomationResult {
    if (!payload.values || payload.values.length === 0) {
      return this.handleError('Values are required for selectOption action')
    }

    let element: Element | null = null

    if (payload.ref) {
      element = findElementByIndex(parseInt(payload.ref))
    } else if (payload.element) {
      element = findElementByText(payload.element)
    }

    if (!element) {
      return this.handleError(`Element not found: ${payload.element || payload.ref}`)
    }

    if (!(element instanceof HTMLSelectElement)) {
      return this.handleError(`Element is not a select: ${payload.element || payload.ref}`)
    }

    const options = Array.from(element.options)
    for (const value of payload.values) {
      const option = options.find(opt => opt.value === value || opt.textContent?.includes(value))
      if (option) {
        option.selected = true
      }
    }

    element.dispatchEvent(new Event('change', { bubbles: true }))

    return { success: true, data: `Selected options in element: ${payload.element || payload.ref}` }
  }

  private handleDrag(payload: ActionPayload): AutomationResult {
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
      return this.handleError('Elements not found for drag operation')
    }

    if (!(startElement instanceof HTMLElement) || !(endElement instanceof HTMLElement)) {
      return this.handleError('Elements are not valid for drag operation')
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

    return { success: true, data: `Dragged from ${payload.startElement || payload.startRef} to ${payload.endElement || payload.endRef}` }
  }

  private handlePressKey(payload: ActionPayload): AutomationResult {
    if (!payload.key) {
      return this.handleError('Key is required for pressKey action')
    }

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

    return { success: true, data: `Pressed key: ${payload.key}` }
  }

  private async handleWait(payload: ActionPayload): Promise<AutomationResult> {
    const time = payload.time || 1
    await new Promise(resolve => setTimeout(resolve, time * 1000))
    return { success: true, data: `Waited for ${time} seconds` }
  }

  private handleGetConsoleLogs(): AutomationResult {
    const logs = (window as any).browserAutomationLogs || []
    return { success: true, data: logs.slice(-50) }
  }
}

new AutomationController()

console.log('[Browser Automation] Ready to execute automation commands')
