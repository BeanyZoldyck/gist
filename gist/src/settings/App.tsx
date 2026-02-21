import { useState, useEffect } from 'react'

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const result = await chrome.storage.local.get(['qdrant_api_key', 'qdrant_endpoint']) as { qdrant_api_key?: string; qdrant_endpoint?: string }
    setApiKey(result.qdrant_api_key || '')
    setEndpoint(result.qdrant_endpoint || 'https://api.qdrant.io')
  }

  const saveSettings = async () => {
    await chrome.storage.local.set({
      qdrant_api_key: apiKey,
      qdrant_endpoint: endpoint
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`${endpoint}/collections`, {
        headers: {
          'api-key': apiKey
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTestResult({
          success: true,
          message: `Connected! Found ${data.result?.collections?.length || 0} collections`
        })
      } else {
        setTestResult({
          success: false,
          message: `Failed: ${response.status} ${response.statusText}`
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${(error as Error).message}`
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6 bg-base-200 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Qdrant Settings</h1>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Cloud Configuration</h2>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Qdrant Endpoint</span>
              </label>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.qdrant.io"
                className="input input-bordered"
              />
              <label className="label">
                <span className="label-text-alt">Qdrant Cloud API URL or self-hosted endpoint</span>
              </label>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">API Key</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Qdrant API key"
                className="input input-bordered"
              />
              <label className="label">
                <a 
                  href="https://cloud.qdrant.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="label-text-alt link"
                >
                  Get API key from Qdrant Cloud →
                </a>
              </label>
            </div>

            <div className="card-actions justify-end mt-4">
              <button
                onClick={testConnection}
                disabled={!apiKey || !endpoint || testing}
                className="btn btn-ghost"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={saveSettings}
                disabled={!apiKey || !endpoint}
                className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
              >
                {saved ? '✓ Saved!' : 'Save Settings'}
              </button>
            </div>

            {testResult && (
              <div className={`alert mt-4 ${testResult.success ? 'alert-success' : 'alert-error'}`}>
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="alert alert-info mt-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">About Qdrant Integration</h3>
            <div className="text-sm">
              <p>• Resources are stored with vector embeddings in Qdrant</p>
              <p>• Semantic search finds related content automatically</p>
              <p>• Cloud embeddings preferred, falls back to local model</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
