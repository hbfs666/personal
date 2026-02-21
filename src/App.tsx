import { useCallback, useEffect, useState } from 'react'
import SendLetter from './pages/SendLetter'
import ViewLetter from './pages/ViewLetter'
import SendToMailboxTransition from './components/SendToMailboxTransition'
import './index.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'send' | 'view'>('send')
  const [letterId, setLetterId] = useState<string | null>(null)
  const [pendingLetterId, setPendingLetterId] = useState<string | null>(null)
  const [isTransitioningToView, setIsTransitioningToView] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (id) {
      setLetterId(id)
      setCurrentPage('view')
    }
  }, [])

  const handleShareLink = (id: string) => {
    setPendingLetterId(id)
    setIsTransitioningToView(true)
  }

  const handleTransitionComplete = useCallback(() => {
    if (!pendingLetterId) {
      setIsTransitioningToView(false)
      return
    }

    window.history.pushState({}, '', `?id=${pendingLetterId}`)
    setLetterId(pendingLetterId)
    setCurrentPage('view')
    setPendingLetterId(null)
    setIsTransitioningToView(false)
  }, [pendingLetterId])

  useEffect(() => {
    if (currentPage !== 'send') {
      return
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (id) {
        setLetterId(id)
        setCurrentPage('view')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentPage])

  useEffect(() => {
    if (currentPage === 'view') {
      setPendingLetterId(null)
      setIsTransitioningToView(false)
    }
  }, [currentPage])

  const handleBackToSend = () => {
    window.history.pushState({}, '', '/')
    setCurrentPage('send')
  }

  if (currentPage === 'view' && letterId) {
    return <ViewLetter letterId={letterId} onBack={handleBackToSend} />
  }

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <SendToMailboxTransition
        visible={isTransitioningToView}
        onComplete={handleTransitionComplete}
      />
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
