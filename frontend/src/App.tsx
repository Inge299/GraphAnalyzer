import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { api } from './services/api'
import './App.css'

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking...')
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const dispatch = useDispatch()

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await api.get('/health')
        setBackendStatus(`Connected to backend (${response.data.environment} mode)`)
        setIsConnected(true)
      } catch (error) {
        setBackendStatus('Backend connection failed')
        setIsConnected(false)
        console.error('Health check failed:', error)
      }
    }

    checkBackendHealth()
    const interval = setInterval(checkBackendHealth, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-container">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
          <img src="/react.svg" className="logo react" alt="React logo" />
        </div>
        <h1>OSINT Graph Analyzer</h1>
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <p className="status-text">{backendStatus}</p>
        </div>
        <p className="description">
          Visualize and analyze relationship graphs from OSINT data
        </p>
        <div className="info-grid">
          <div className="info-card">
            <h3>Graph Visualization</h3>
            <p>Interactive graph visualization with support for up to 5,000 nodes and 50,000 edges</p>
          </div>
          <div className="info-card">
            <h3>Plugin System</h3>
            <p>Extensible plugin architecture for custom analysis algorithms</p>
          </div>
          <div className="info-card">
            <h3>Real-time Updates</h3>
            <p>WebSocket support for live graph updates and collaboration</p>
          </div>
        </div>
        <div className="action-buttons">
          <button className="primary-button" disabled={!isConnected}>
            Create New Graph
          </button>
          <button className="secondary-button" disabled={!isConnected}>
            Load Sample Data
          </button>
        </div>
      </header>
    </div>
  )
}

export default App
