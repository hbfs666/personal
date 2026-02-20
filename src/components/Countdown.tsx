import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  startTime: Date
  endTime: Date
  status: 'waiting' | 'sent' | 'transit' | 'delivered'
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export default function Countdown({ startTime, endTime, status }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  const [waitingTime, setWaitingTime] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()

      if (status === 'waiting') {
        // Show time until sending
        const diff = startTime.getTime() - now.getTime()
        if (diff > 0) {
          const seconds = Math.floor((diff / 1000) % 60)
          const minutes = Math.floor((diff / (1000 * 60)) % 60)
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))

          setWaitingTime({ days, hours, minutes, seconds })
        }
      } else {
        // Show time until delivery
        const diff = endTime.getTime() - now.getTime()
        if (diff > 0) {
          const seconds = Math.floor((diff / 1000) % 60)
          const minutes = Math.floor((diff / (1000 * 60)) % 60)
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))

          setTimeLeft({ days, hours, minutes, seconds })
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, endTime, status])

  const timeDisplay = status === 'waiting' ? waitingTime : timeLeft

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <motion.div
      key={`${label}-${value}`}
      initial={{ scale: 1.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex flex-col items-center"
    >
      <div className="bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg px-4 py-3 min-w-20">
        <span className="text-white text-2xl font-bold">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs font-semibold text-gray-700 mt-2">{label}</span>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-indigo-200"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">⏱️ 倒數計時</h3>
          <p className="text-sm text-gray-600">
            {status === 'waiting'
              ? '距離寄送還有'
              : status === 'delivered'
              ? '信件已送達！'
              : '距離送達還有'}
          </p>
        </div>

        {status !== 'delivered' && (
          <div className="flex justify-center gap-4">
            <TimeBox value={timeDisplay.days} label="天" />
            <TimeBox value={timeDisplay.hours} label="時" />
            <TimeBox value={timeDisplay.minutes} label="分" />
            <TimeBox value={timeDisplay.seconds} label="秒" />
          </div>
        )}

        {status === 'delivered' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 100 }}
            className="text-center py-8"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-6xl mb-4"
            >
              🎉
            </motion.div>
            <p className="text-2xl font-bold text-indigo-900">感謝你的信！</p>
            <p className="text-gray-600 mt-2">信件已成功送達</p>
          </motion.div>
        )}

        {/* Status Message */}
        <div className="bg-indigo-50 rounded-lg p-4 border-l-4 border-indigo-500">
          <p className="text-sm font-semibold text-indigo-900">
            {status === 'waiting' && '⏳ 信件正在準備中...'}
            {status === 'sent' && '📮 信件已投遞，即將開始運送'}
            {status === 'transit' && '✈️  信件正在運送途中，敬請期待'}
            {status === 'delivered' && '📬 信件已到達目的地'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
