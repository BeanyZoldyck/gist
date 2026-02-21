export default function App() {
  const openSidePanel = async () => {
    const currentWindow = await chrome.windows.getCurrent()
    if (currentWindow.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id })
    }
  }

  const openSettings = async () => {
    await chrome.runtime.openOptionsPage()
  }

  const activateLinkHints = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_LINK_HINTS' }, () => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Failed to activate link hints')
          }
        })
      }
    })
  }

  return (
    <div className="p-4 bg-base-200 min-w-[300px]">
      <div className="flex flex-col gap-3">
        <button
          onClick={activateLinkHints}
          className="btn btn-ghost justify-start gap-3"
        >
          <span className="text-xl">🔗</span>
          <div className="text-left">
            <div className="text-sm font-medium">Link Hints</div>
            <div className="text-[10px] opacity-50">Ctrl+Shift+L</div>
          </div>
        </button>

        <button
          onClick={openSidePanel}
          className="btn btn-ghost justify-start gap-3"
        >
          <span className="text-xl">📂</span>
          <div className="text-left">
            <div className="text-sm font-medium">Resources</div>
            <div className="text-[10px] opacity-50">View saved</div>
          </div>
        </button>

        <div className="divider my-0"></div>

        <button
          onClick={openSettings}
          className="btn btn-ghost justify-start gap-3"
        >
          <span className="text-xl">⚙️</span>
          <div className="text-left">
            <div className="text-sm font-medium">Settings</div>
            <div className="text-[10px] opacity-50">Qdrant config</div>
          </div>
        </button>
      </div>
    </div>
  )
}
