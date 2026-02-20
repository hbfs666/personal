import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import PaperAirplaneAnimation from '../components/PaperAirplaneAnimation.tsx'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path}`
const mediaUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path}`
}

interface Letter {
  id: string
  senderName: string
  recipientName: string
  letterContent: string
  imageUrls?: string[]
  audioUrl?: string | null
  delayDays?: number
  delayMinutes?: number
  scheduleTime: string
  isRevealed: boolean
  timeLeft: number
}

interface ViewLetterProps {
  letterId: string
  onBack: () => void
}

export default function ViewLetter({ letterId, onBack }: ViewLetterProps) {
  const [letter, setLetter] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const getTotalDelayMinutes = (currentLetter: Letter) => {
    if (typeof currentLetter.delayMinutes === 'number') {
      return currentLetter.delayMinutes
    }
    return (currentLetter.delayDays || 0) * 24 * 60
  }

  const getDelayDisplayText = (totalDelayMinutes: number) => {
    if (totalDelayMinutes <= 0) return '立即'
    if (totalDelayMinutes % (24 * 60) === 0) {
      return `${totalDelayMinutes / (24 * 60)} 天`
    }
    if (totalDelayMinutes % 60 === 0) {
      return `${totalDelayMinutes / 60} 小時`
    }
    return `${totalDelayMinutes} 分鐘`
  }

  const handleDownloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(mediaUrl(imageUrl))
      if (!response.ok) {
        throw new Error('下載失敗')
      }

      const blob = await response.blob()
      const ext = blob.type.split('/')[1] || 'jpg'
      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `letter-image-${index + 1}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      console.error('Download failed:', downloadError)
    }
  }

  const handleDownloadAudio = async (audioUrl: string) => {
    try {
      const response = await fetch(mediaUrl(audioUrl))
      if (!response.ok) {
        throw new Error('下載失敗')
      }

      const blob = await response.blob()
      const ext = blob.type.split('/')[1] || 'mp3'
      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `letter-audio.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      console.error('Audio download failed:', downloadError)
    }
  }

  const currentLink = `${window.location.origin}?id=${letterId}`

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(currentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${letter?.senderName || '筆友'} 寄來的一封信`,
          text: '這是一封時光信件，打開看看吧！',
          url: currentLink
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } else {
        await handleCopyLink()
      }
    } catch (shareError) {
      console.error('Share canceled or failed:', shareError)
    }
  }

  useEffect(() => {
    const fetchLetter = async () => {
      try {
        const response = await fetch(apiUrl(`/api/letters/${letterId}`))
        if (!response.ok) {
          throw new Error('信件未找到')
        }
        const data = await response.json()
        setLetter(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加載失敗')
      } finally {
        setLoading(false)
      }
    }

    fetchLetter()

    const interval = setInterval(fetchLetter, 1000)
    return () => clearInterval(interval)
  }, [letterId])

  useEffect(() => {
    if (letter) {
      const totalTime = getTotalDelayMinutes(letter) * 60 * 1000
      if (totalTime <= 0) {
        setProgress(100)
      } else {
        const elapsed = Math.max(0, totalTime - letter.timeLeft)
        const progressPercent = Math.min((elapsed / totalTime) * 100, 100)
        setProgress(Number.isFinite(progressPercent) ? progressPercent : 0)
      }

      if (!letter.isRevealed) {
        const ms = letter.timeLeft
        const days = Math.floor(ms / (24 * 60 * 60 * 1000))
        const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
        const seconds = Math.floor((ms % (60 * 1000)) / 1000)

        setTimeLeft(`${days}天 ${hours}小時 ${minutes}分 ${seconds}秒`)
      }
    }
  }, [letter])

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-4"
          >
            📮
          </motion.div>
          <p className="text-xl text-indigo-900">正在加載信件...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <p className="text-2xl text-red-600 mb-4">❌ {error}</p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  if (!letter) {
    return null
  }

  const totalDelayMinutes = getTotalDelayMinutes(letter)
  const delayDisplayText = getDelayDisplayText(totalDelayMinutes)

  return (
    <div className="min-h-screen bg-transparent py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
          >
            ← 返回
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-4 py-2 rounded-lg font-semibold text-white transition ${
              copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {copied ? '✓ 已複製' : '📋 複製連結'}
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            className={`px-4 py-2 rounded-lg font-semibold text-white transition ${
              shared ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {shared ? '✓ 已分享' : '📤 分享連結'}
          </button>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white">
            <p className="text-sm opacity-90">來自</p>
            <h1 className="text-4xl font-bold mb-2">{letter.senderName}</h1>
            <p className="text-blue-100">寄給 {letter.recipientName}</p>
          </div>

          {/* Paper Airplane Animation */}
          <div className="mb-6">
            <PaperAirplaneAnimation progress={progress} />
          </div>

          {/* Status Bar */}
          <div className="bg-blue-50 p-6 border-b-2 border-blue-200">
            {letter.isRevealed ? (
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-5xl mb-2"
                >
                  🔓
                </motion.div>
                <p className="text-xl font-bold text-green-600">信件已解鎖！</p>
                <p className="text-sm text-gray-600">你現在可以查看完整內容</p>
              </div>
            ) : totalDelayMinutes === 0 ? (
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-5xl mb-2"
                >
                  🔓
                </motion.div>
                <p className="text-xl font-bold text-green-600">立即可查看！</p>
                <p className="text-sm text-gray-600">信件內容馬上呈現</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">信件在此之前保持鎖定 🔒</p>
                <p className="text-2xl font-bold text-indigo-900">{timeLeft}</p>
                <p className="text-xs text-gray-500 mt-2">
                  請耐心等待~~~
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Audio Section */}
            {letter.audioUrl && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                {letter.isRevealed ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-indigo-900">🎵 附加音頻</p>
                    <audio
                      controls
                      src={mediaUrl(letter.audioUrl)}
                      className="w-full"
                    />
                    <button
                      type="button"
                      onClick={() => handleDownloadAudio(letter.audioUrl as string)}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition"
                    >
                      ⬇️ 下載音頻
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-indigo-900">
                    <div className="text-4xl mb-2">🔒</div>
                    <p className="font-semibold">音頻尚未解鎖</p>
                    <p className="text-xs text-gray-600 mt-1">解鎖後才能播放與下載</p>
                  </div>
                )}
              </div>
            )}

            {/* Images Gallery */}
            {letter.imageUrls && letter.imageUrls.length > 0 && (
              <motion.div
                initial={{ opacity: 0.3 }}
                animate={{
                  opacity: letter.isRevealed ? 1 : 0.3,
                }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {letter.imageUrls.map((imageUrl, index) => (
                  <div key={index} className="overflow-hidden rounded-lg border border-blue-100 bg-white">
                    {letter.isRevealed ? (
                      <>
                        <img
                          src={mediaUrl(imageUrl)}
                          alt={`信紙 ${index + 1}`}
                          className="w-full max-h-96 object-cover"
                        />
                        <div className="flex gap-2 p-3 border-t border-blue-100 bg-blue-50">
                          <a
                            href={mediaUrl(imageUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                          >
                            🔍 開啟圖片
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDownloadImage(imageUrl, index)}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition"
                          >
                            ⬇️ 下載圖片
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="h-56 flex flex-col items-center justify-center bg-blue-50 text-blue-900">
                        <div className="text-4xl mb-2">🔒</div>
                        <p className="font-semibold">圖片尚未解鎖</p>
                        <p className="text-xs text-gray-600 mt-1">解鎖後才能查看與下載</p>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* Letter Content */}
            <motion.div
              initial={{ opacity: 0.3, filter: 'blur(10px)' }}
              animate={{
                opacity: letter.isRevealed ? 1 : 0.3,
                filter: letter.isRevealed ? 'blur(0px)' : 'blur(10px)'
              }}
              transition={{ duration: 0.5 }}
              className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200"
            >
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                {letter.letterContent}
              </p>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 text-center text-xs text-gray-500 border-t">
            <p>📨 一份特別的信件</p>
            <p className="mt-1">寄送於 {new Date(letter.scheduleTime).toLocaleString('zh-TW')}</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
