import { motion } from 'framer-motion'

interface Props {
  progress: number
}

export default function ProgressBar({ progress }: Props) {
  const percentage = Math.round(progress * 100)

  const stages = [
    { label: '準備中', percentage: 0 },
    { label: '已投遞', percentage: 25 },
    { label: '運送中', percentage: 50 },
    { label: '即將送達', percentage: 75 },
    { label: '已送達', percentage: 100 }
  ]

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-purple-200"
    >
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-indigo-900">📊 信件進度</h3>

        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
              initial={{ width: '0%' }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>開始</span>
            <span className="font-bold text-indigo-900">{percentage}%</span>
            <span>送達</span>
          </div>
        </div>

        {/* Stage Indicators */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isActive = progress * 100 >= stage.percentage
            return (
              <motion.div
                key={stage.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white scale-110'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`font-semibold transition-all ${
                    isActive ? 'text-indigo-900' : 'text-gray-500'
                  }`}
                >
                  {stage.label}
                </span>
                {isActive && (
                  <motion.span
                    className="text-green-500 ml-auto"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
