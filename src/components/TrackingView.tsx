import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import LetterMap from './LetterMap.tsx'
import ProgressBar from './ProgressBar.tsx'
import Countdown from './Countdown.tsx'

interface LetterData {
  senderName: string
  senderCity: string
  recipientName: string
  recipientCity: string
  scheduledTime: string
  estimatedDays: number
  letterContent: string
}

type LetterStatus = 'waiting' | 'sent' | 'transit' | 'delivered'

interface Props {
  letterData: LetterData
  onBack: () => void
}

const CITY_COORDS: Record<string, [number, number]> = {
  '台北': [25.0330, 121.5654],
  '台中': [24.1372, 120.6736],
  '高雄': [22.6273, 120.3014],
  '台南': [22.9868, 120.2153],
  '東京': [35.6762, 139.6503],
  '大阪': [34.6937, 135.5023],
  '京都': [35.0116, 135.7681],
  '橫濱': [35.4437, 139.6380],
  '首爾': [37.5665, 126.9780],
  '釜山': [35.1796, 129.0756],
  '曼谷': [13.7563, 100.5018],
  '清邁': [18.7883, 98.9853],
  '新加坡': [1.3521, 103.8198],
  '香港': [22.3193, 114.1694],
  '上海': [31.2304, 121.4737],
  '北京': [39.9042, 116.4074]
}

export default function TrackingView({ letterData, onBack }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<LetterStatus>('waiting')
  
  const scheduledDate = new Date(letterData.scheduledTime)
  const deliveryDate = new Date(scheduledDate.getTime() + letterData.estimatedDays * 24 * 60 * 60 * 1000)
  const realStartTime = scheduledDate.getTime()
  const realEndTime = deliveryDate.getTime()
  const totalDuration = realEndTime - realStartTime

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      
      if (now < realStartTime) {
        setStatus('waiting')
        setElapsed(0)
      } else if (now < realStartTime + totalDuration * 0.2) {
        setStatus('sent')
        setElapsed((now - realStartTime) / totalDuration)
      } else if (now < realEndTime) {
        setStatus('transit')
        setElapsed((now - realStartTime) / totalDuration)
      } else {
        setStatus('delivered')
        setElapsed(1)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [realStartTime, realEndTime, totalDuration])

  const senderCoords = CITY_COORDS[letterData.senderCity] || [0, 0]
  const recipientCoords = CITY_COORDS[letterData.recipientCity] || [0, 0]

  const getStatusEmoji = () => {
    switch (status) {
      case 'waiting':
        return '📝'
      case 'sent':
        return '📮'
      case 'transit':
        return '✈️'
      case 'delivered':
        return '📬'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'waiting':
        return '準備中'
      case 'sent':
        return '已投遞'
      case 'transit':
        return '運送中'
      case 'delivered':
        return '已送達'
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="mb-4 px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition"
      >
        ← 返回
      </button>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-indigo-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">寄件人</p>
            <h3 className="text-2xl font-bold text-indigo-900">{letterData.senderName}</h3>
            <p className="text-indigo-600">{letterData.senderCity}</p>
          </div>
          
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-5xl mb-2"
            >
              {getStatusEmoji()}
            </motion.div>
            <p className="text-xl font-bold text-indigo-900">{getStatusText()}</p>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">收件人</p>
            <h3 className="text-2xl font-bold text-indigo-900">{letterData.recipientName}</h3>
            <p className="text-indigo-600">{letterData.recipientCity}</p>
          </div>
        </div>
      </motion.div>

      {/* Map */}
      <LetterMap
        senderCoords={senderCoords}
        recipientCoords={recipientCoords}
        progress={elapsed}
      />

      {/* Progress Bar */}
      <ProgressBar progress={elapsed} />

      {/* Countdown and Letter Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Countdown
          startTime={new Date(letterData.scheduledTime)}
          endTime={deliveryDate}
          status={status}
        />

        {letterData.letterContent && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-yellow-200 bg-yellow-50"
          >
            <h3 className="text-xl font-bold text-yellow-900 mb-4">💌 信件內容</h3>
            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
              {letterData.letterContent}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
