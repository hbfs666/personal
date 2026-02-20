import { useState, useEffect } from 'react'
import SendLetter from './pages/SendLetter'
import ViewLetter from './pages/ViewLetter'
import './index.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'send' | 'view'>('send')
  const [letterId, setLetterId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (id) {
      setLetterId(id)
      setCurrentPage('view')
    }
  }, [])

  const handleShareLink = (id: string) => {
    window.history.pushState({}, '', `?id=${id}`)
    setLetterId(id)
    setCurrentPage('view')
  }

  const handleBackToSend = () => {
    window.history.pushState({}, '', '/')
    setCurrentPage('send')
  }

  if (currentPage === 'view' && letterId) {
    return <ViewLetter letterId={letterId} onBack={handleBackToSend} />
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12 bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg border border-white/70 py-8 px-6">
          <h1 className="text-5xl font-bold text-indigo-900 mb-2">
            📮 延時信件系統
          </h1>
          <p className="text-indigo-600 text-lg">
            寄送你的信件，設定延遲時間讓朋友驚喜發現
          </p>
        </header>

        <SendLetter onLetterSent={handleShareLink} />
      </div>
    </div>
  )
}

export default App
