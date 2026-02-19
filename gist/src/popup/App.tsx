import { useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('')

  const openSidePanel = async () => {
    const currentWindow = await chrome.windows.getCurrent()
    if (currentWindow.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id })
    }
  }

  const activateLinkHints = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_LINK_HINTS' }, () => {
          if (chrome.runtime.lastError) {
            setStatus('Error: Content script not loaded. Refresh the page.')
            setTimeout(() => setStatus(''), 3000)
          } else {
            setStatus('Link hints activated! Press Esc to exit.')
            setTimeout(() => setStatus(''), 3000)
          }
        })
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Gist</h1>
        <p className="text-gray-400">Link selector & AI assistant</p>
      </div>
      
      <div className="space-y-6">
        <button 
          onClick={activateLinkHints}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Activate Link Hints
        </button>
        
        <button 
          onClick={openSidePanel}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Open Side Panel
        </button>

        {status && (
          <div className="p-3 bg-gray-800 rounded-lg text-center text-sm">
            {status}
          </div>
        )}
        
        <div className="bg-gray-800/50 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Link Hints</h3>
          <p className="text-gray-400 text-sm mb-3">
            Keyboard: <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">Ctrl+Shift+L</code> or <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">Cmd+Shift+L</code>
          </p>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Click above or use keyboard shortcut</li>
            <li>Navigate with j/k or arrow keys</li>
            <li>Press Enter to select & save link</li>
          </ol>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-5">
          <h3 className="font-semibold mb-3">AI Assistant Setup</h3>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Start API server: <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">python api_server.py</code></li>
            <li>Upload docs via <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">upload.py</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
