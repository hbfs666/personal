import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import PaperAirplaneAnimation from '../components/PaperAirplaneAnimation.tsx'

const LOCAL_FALLBACK_API_BASE_URL =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? 'http://localhost:3001'
    : ''
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || LOCAL_FALLBACK_API_BASE_URL || '').replace(/\/$/, '')
const AMBIENT_TRACK_PATH =
  import.meta.env.VITE_AMBIENT_MUSIC_PATH || "/music/[no copyright music] 'In Dreamland ' background music.mp3"
const apiUrl = (path: string) => `${API_BASE_URL}${path}`
const mediaUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path}`
}

const encodedPublicPath = (path: string) =>
  path
    .split('/')
    .map((segment, index) => (index === 0 && segment === '' ? '' : encodeURIComponent(segment)))
    .join('/')

interface Letter {
  id: string
  senderName: string
  senderCountry?: string | null
  recipientName: string
  letterContent: string
  imageUrls?: string[]
  videoUrls?: string[]
  audioUrl?: string | null
  stampData?: string | null
  paperTheme?: 'classic' | 'warm' | 'mint' | 'lavender'
  ambienceMusic?: boolean
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
  const [musicOn, setMusicOn] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [editLetterContent, setEditLetterContent] = useState('')
  const [editDelayDays, setEditDelayDays] = useState<number | ''>(0)
  const [editDelayHours, setEditDelayHours] = useState<number | ''>(0)
  const [editDelayMinutesPart, setEditDelayMinutesPart] = useState<number | ''>(0)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [confettiPieces, setConfettiPieces] = useState<Array<{
    id: number
    left: string
    duration: number
    delay: number
    emoji: string
  }>>([])
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null)

  const paperThemeClassMap = {
    classic: 'bg-yellow-50 border-yellow-200 text-gray-700',
    warm: 'bg-orange-50 border-orange-200 text-orange-900',
    mint: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    lavender: 'bg-violet-50 border-violet-200 text-violet-900'
  }

  const getTotalDelayMinutes = (currentLetter: Letter) => {
    if (typeof currentLetter.delayMinutes === 'number') {
      return currentLetter.delayMinutes
    }
    return (currentLetter.delayDays || 0) * 24 * 60
  }

  const getDelayDisplayText = (totalDelayMinutes: number) => {
    if (totalDelayMinutes <= 0) return '立即'

    const days = Math.floor(totalDelayMinutes / (24 * 60))
    const hours = Math.floor((totalDelayMinutes % (24 * 60)) / 60)
    const minutes = totalDelayMinutes % 60
    const parts: string[] = []
    if (days > 0) parts.push(`${days} 天`)
    if (hours > 0) parts.push(`${hours} 小時`)
    if (minutes > 0) parts.push(`${minutes} 分鐘`)
    return parts.join(' ')
  }

  const splitDelayMinutes = (totalDelayMinutes: number) => {
    const safeTotal = Math.max(0, Math.min(totalDelayMinutes, 30 * 24 * 60))
    return {
      days: Math.floor(safeTotal / (24 * 60)),
      hours: Math.floor((safeTotal % (24 * 60)) / 60),
      minutes: safeTotal % 60
    }
  }

  const normalizeEditDelayPart = (value: number | '', max: number) => {
    if (value === '' || !Number.isFinite(value)) {
      return 0
    }
    return Math.max(0, Math.min(max, Math.trunc(value)))
  }

  const getSafeEditDelayParts = () => {
    const safeDays = normalizeEditDelayPart(editDelayDays, 30)
    const safeHours = normalizeEditDelayPart(editDelayHours, 23)
    const safeMinutes = normalizeEditDelayPart(editDelayMinutesPart, 59)
    return { safeDays, safeHours, safeMinutes }
  }

  const getEditDelayTotalMinutes = () => {
    const { safeDays, safeHours, safeMinutes } = getSafeEditDelayParts()
    return Math.max(0, Math.min(safeDays * 24 * 60 + safeHours * 60 + safeMinutes, 30 * 24 * 60))
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

  const handleDownloadVideo = async (videoUrl: string, index: number) => {
    try {
      const response = await fetch(mediaUrl(videoUrl))
      if (!response.ok) {
        throw new Error('下載失敗')
      }

      const blob = await response.blob()
      const ext = blob.type.split('/')[1] || 'mp4'
      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `letter-video-${index + 1}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      console.error('Video download failed:', downloadError)
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

  useEffect(() => {
    if (!letter) return
    setEditLetterContent(letter.letterContent || '')
    const total = getTotalDelayMinutes(letter)
    const parts = splitDelayMinutes(total)
    setEditDelayDays(parts.days)
    setEditDelayHours(parts.hours)
    setEditDelayMinutesPart(parts.minutes)
  }, [letter?.id, letter?.letterContent, letter?.delayMinutes, letter?.delayDays])

  useEffect(() => {
    if (letter?.ambienceMusic === true) {
      setMusicOn(true)
    } else {
      setMusicOn(false)
    }
  }, [letter?.id, letter?.ambienceMusic])

  useEffect(() => {
    if (previewImageIndex === null || !letter?.imageUrls?.length) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImageIndex(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        setPreviewImageIndex((prev) => {
          if (prev === null || !letter.imageUrls?.length) return prev
          return (prev - 1 + letter.imageUrls.length) % letter.imageUrls.length
        })
      }
      if (e.key === 'ArrowRight') {
        setPreviewImageIndex((prev) => {
          if (prev === null || !letter.imageUrls?.length) return prev
          return (prev + 1) % letter.imageUrls.length
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImageIndex, letter?.imageUrls])

  useEffect(() => {
    if (letter?.isRevealed) {
      const emojis = ['✨', '🎉', '💫', '🎊', '🧸', '🌟']
      const generated = Array.from({ length: 14 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 90 + 5}%`,
        duration: 2.2 + Math.random() * 1.8,
        delay: Math.random() * 1.2,
        emoji: emojis[Math.floor(Math.random() * emojis.length)]
      }))
      setConfettiPieces(generated)
    } else {
      setConfettiPieces([])
    }
  }, [letter?.isRevealed, letter?.id])

  useEffect(() => {
    const audio = new Audio(encodedPublicPath(AMBIENT_TRACK_PATH))
    audio.loop = true
    audio.volume = 0.35
    audio.preload = 'auto'
    ambientAudioRef.current = audio

    return () => {
      audio.pause()
      audio.currentTime = 0
      ambientAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const ambientAudio = ambientAudioRef.current
    if (!ambientAudio) {
      return
    }

    if (!letter?.isRevealed || letter.ambienceMusic === false || !musicOn) {
      ambientAudio.pause()
      ambientAudio.currentTime = 0
      return
    }

    ambientAudio.play().catch((audioError) => {
      console.error('Ambient audio start failed:', audioError)
    })
  }, [letter?.isRevealed, letter?.ambienceMusic, musicOn])

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
  const selectedPaperTheme = letter.paperTheme || 'classic'
  const paperThemeClassName = paperThemeClassMap[selectedPaperTheme] || paperThemeClassMap.classic

  const handleOpenEditModal = () => {
    const currentDelayParts = splitDelayMinutes(totalDelayMinutes)
    setEditLetterContent(letter.letterContent || '')
    setEditDelayDays(currentDelayParts.days)
    setEditDelayHours(currentDelayParts.hours)
    setEditDelayMinutesPart(currentDelayParts.minutes)
    setEditPassword('')
    setEditError(null)
    setEditSuccess(null)
    setIsEditModalOpen(true)
  }

  const handleSubmitPendingEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(null)

    if (editPassword.trim().length < 1) {
      setEditError('請輸入修改密碼')
      return
    }

    setEditSubmitting(true)
    try {
      const { safeDays, safeHours, safeMinutes } = getSafeEditDelayParts()

      const response = await fetch(apiUrl(`/api/letters/${letterId}/edit`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: editPassword,
          letterContent: editLetterContent,
          delayDays: safeDays,
          delayHours: safeHours,
          delayMinutesPart: safeMinutes
        })
      })

      const responseText = await response.text()
      let payload: any = null
      try {
        payload = responseText ? JSON.parse(responseText) : null
      } catch {
        payload = null
      }

      if (!response.ok) {
        throw new Error(payload?.message || `修改失敗 (${response.status})`)
      }

      const nextDelayMinutes = getEditDelayTotalMinutes()
      setLetter((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          letterContent: editLetterContent,
          delayMinutes: nextDelayMinutes,
          delayDays: Math.floor(nextDelayMinutes / (24 * 60))
        }
      })
      setEditSuccess(payload?.message || '修改成功')
      setTimeout(() => {
        setIsEditModalOpen(false)
      }, 700)
    } catch (submitError) {
      setEditError(submitError instanceof Error ? submitError.message : '寄送中修改失敗')
    } finally {
      setEditSubmitting(false)
    }
  }

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
          {letter.isRevealed && letter.ambienceMusic !== false && (
            <button
              type="button"
              onClick={() => setMusicOn((prev) => !prev)}
              className={`px-4 py-2 rounded-lg font-semibold text-white transition ${
                musicOn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {musicOn ? '🎵 氛圍音樂開' : '🔇 氛圍音樂關'}
            </button>
          )}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white flex items-center justify-between gap-4">
            <div>
              <p className="text-sm opacity-90">來自</p>
              <h1 className="text-4xl font-bold mb-2">{letter.senderName}</h1>
              <p className="text-blue-100">寄給 {letter.recipientName}</p>
              <p className="text-blue-100 text-sm mt-1">🌍 發信地：{letter.senderCountry || '未知'}</p>
            </div>
            {letter.isRevealed && letter.stampData && (
              <div className="rounded-lg border-2 border-amber-300 bg-white p-1 shadow-md shrink-0">
                <img
                  src={letter.stampData}
                  alt="自製郵票"
                  className="w-24 h-24 object-cover rounded-sm"
                />
              </div>
            )}
          </div>

          {/* Paper Airplane Animation */}
          <div className="mb-6">
            <PaperAirplaneAnimation progress={progress} />
          </div>

          {/* Status Bar */}
          <div className="bg-blue-50 border-blue-200 p-6 border-b-2">
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
                  這封信設定為 {delayDisplayText} 後解鎖，請耐心等待~~~
                </p>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  ✏️ 寄送中修改（需密碼）
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-8 space-y-6 relative overflow-hidden">
            {letter.isRevealed && confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                className="absolute text-lg pointer-events-none"
                style={{ left: piece.left, top: '-8%' }}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: ['0%', '125%'], opacity: [0, 1, 0] }}
                transition={{ duration: piece.duration, delay: piece.delay, repeat: Infinity, repeatDelay: 1 }}
              >
                {piece.emoji}
              </motion.div>
            ))}
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
                          <button
                            type="button"
                            onClick={() => setPreviewImageIndex(index)}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                          >
                            🔍 預覽圖片
                          </button>
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

            {/* Videos Gallery */}
            {letter.videoUrls && letter.videoUrls.length > 0 && (
              <motion.div
                initial={{ opacity: 0.3 }}
                animate={{ opacity: letter.isRevealed ? 1 : 0.3 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {letter.videoUrls.map((videoUrl, index) => (
                  <div key={index} className="overflow-hidden rounded-lg border border-purple-100 bg-white">
                    {letter.isRevealed ? (
                      <>
                        <video
                          controls
                          src={mediaUrl(videoUrl)}
                          className="w-full max-h-96 bg-black"
                        />
                        <div className="flex gap-2 p-3 border-t border-purple-100 bg-purple-50">
                          <a
                            href={mediaUrl(videoUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                          >
                            🎬 開啟影片
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDownloadVideo(videoUrl, index)}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition"
                          >
                            ⬇️ 下載影片
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="h-56 flex flex-col items-center justify-center bg-purple-50 text-purple-900">
                        <div className="text-4xl mb-2">🔒</div>
                        <p className="font-semibold">影片尚未解鎖</p>
                        <p className="text-xs text-gray-600 mt-1">解鎖後才能播放與下載</p>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {/* Letter Content */}
            {letter.isRevealed ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`p-6 rounded-lg border-2 ${paperThemeClassName} relative overflow-hidden`}
              >
                <p
                  className="whitespace-pre-wrap leading-relaxed text-sm"
                >
                  {letter.letterContent}
                </p>
              </motion.div>
            ) : (
              <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200 text-center">
                <div className="text-4xl mb-2">🔒</div>
                <p className="font-semibold text-yellow-900">信件正文尚未解鎖</p>
                <p className="text-xs text-gray-600 mt-1">到達解鎖時間後即可查看完整內容</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 text-center text-xs text-gray-500 border-t">
            <p>📨 一份特別的信件</p>
            <p className="mt-1">寄送於 {new Date(letter.scheduleTime).toLocaleString('zh-TW')}</p>
          </div>
        </motion.div>
      </div>

      {previewImageIndex !== null && letter?.imageUrls && letter.imageUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPreviewImageIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                const imageCount = letter.imageUrls?.length || 0
                if (imageCount === 0) return
                setPreviewImageIndex((previewImageIndex - 1 + imageCount) % imageCount)
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-gray-900 font-bold shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                const imageCount = letter.imageUrls?.length || 0
                if (imageCount === 0) return
                setPreviewImageIndex((previewImageIndex + 1) % imageCount)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-gray-900 font-bold shadow hover:bg-white"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPreviewImageIndex(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-gray-800 font-bold shadow hover:bg-gray-100"
            >
              ✕
            </button>
            <img
              src={mediaUrl(letter.imageUrls[previewImageIndex])}
              alt="圖片預覽"
              className="w-full max-h-[85vh] object-contain rounded-lg bg-black"
            />
            <p className="mt-2 text-center text-white text-sm">
              {previewImageIndex + 1} / {letter.imageUrls.length}
            </p>
          </div>
        </div>
      )}

      {isEditModalOpen && !letter.isRevealed && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-indigo-900 mb-4">寄送中修改（需密碼）</h3>
            {editError && (
              <p className="mb-3 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm">{editError}</p>
            )}
            {editSuccess && (
              <p className="mb-3 px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm">{editSuccess}</p>
            )}
            <form onSubmit={handleSubmitPendingEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">修改密碼</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  placeholder="輸入寄信時設定的密碼"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">信件內容</label>
                <textarea
                  value={editLetterContent}
                  onChange={(e) => setEditLetterContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">天（0-30）</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={editDelayDays}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      if (nextValue === '') {
                        setEditDelayDays('')
                        return
                      }
                      const parsed = Number.parseInt(nextValue, 10)
                      if (Number.isFinite(parsed)) {
                        setEditDelayDays(parsed)
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">小時（0-23）</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={editDelayHours}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      if (nextValue === '') {
                        setEditDelayHours('')
                        return
                      }
                      const parsed = Number.parseInt(nextValue, 10)
                      if (Number.isFinite(parsed)) {
                        setEditDelayHours(parsed)
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">分鐘（0-59）</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={editDelayMinutesPart}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      if (nextValue === '') {
                        setEditDelayMinutesPart('')
                        return
                      }
                      const parsed = Number.parseInt(nextValue, 10)
                      if (Number.isFinite(parsed)) {
                        setEditDelayMinutesPart(parsed)
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:bg-gray-400"
                >
                  {editSubmitting ? '儲存中...' : '儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
