import { motion } from 'framer-motion'

interface Props {
  senderCoords: [number, number]
  recipientCoords: [number, number]
  progress: number
}

export default function LetterMap({
  senderCoords,
  recipientCoords,
  progress
}: Props) {
  // Simple projection for visualization
  const projectCoords = (lat: number, lng: number): [number, number] => {
    // World map bounds
    const minLat = -85
    const maxLat = 85
    const minLng = -180
    const maxLng = 180

    // Canvas dimensions
    const width = 800
    const height = 400

    const x = ((lng - minLng) / (maxLng - minLng)) * width
    const y = ((maxLat - lat) / (maxLat - minLat)) * height

    return [x, y]
  }

  const startPos = projectCoords(senderCoords[0], senderCoords[1])
  const endPos = projectCoords(recipientCoords[0], recipientCoords[1])

  // Bezier curve control point for a nice arc
  const controlX = (startPos[0] + endPos[0]) / 2
  const controlY = Math.min(startPos[1], endPos[1]) - 100

  // Calculate current position along the path
  const currentX = Math.pow(1 - progress, 2) * startPos[0] +
    2 * (1 - progress) * progress * controlX +
    Math.pow(progress, 2) * endPos[0]

  const currentY = Math.pow(1 - progress, 2) * startPos[1] +
    2 * (1 - progress) * progress * controlY +
    Math.pow(progress, 2) * endPos[1]

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-cyan-200 overflow-hidden"
    >
      <h3 className="text-xl font-bold text-indigo-900 mb-6">🗺️ 信件路線</h3>

      <svg
        viewBox="0 0 800 400"
        className="w-full h-auto bg-gradient-to-r from-cyan-100 to-blue-100 rounded-xl"
      >
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e7ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="800" height="400" fill="url(#grid)" />

        {/* Bezier curve path */}
        <path
          d={`M ${startPos[0]} ${startPos[1]} Q ${controlX} ${controlY} ${endPos[0]} ${endPos[1]}`}
          stroke="#a5b4fc"
          strokeWidth="3"
          fill="none"
          strokeDasharray="1000"
          strokeDashoffset={`${(1 - progress) * 1000}`}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />

        {/* Start point */}
        <circle cx={startPos[0]} cy={startPos[1]} r="8" fill="#6366f1" />
        <text
          x={startPos[0]}
          y={startPos[1] - 15}
          textAnchor="middle"
          className="text-sm font-bold fill-indigo-900"
        >
          出發地
        </text>

        {/* Letter icon at current position */}
        <motion.g
          key="letter"
          animate={{ y: Math.sin(Date.now() / 500) * 5 }}
        >
          <rect
            x={currentX - 12}
            y={currentY - 12}
            width="24"
            height="24"
            rx="2"
            fill="#6366f1"
            stroke="white"
            strokeWidth="2"
          />
          <path
            d={`M ${currentX - 8} ${currentY - 4} L ${currentX} ${currentY + 4} L ${currentX + 8} ${currentY - 4}`}
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
        </motion.g>

        {/* End point */}
        <circle cx={endPos[0]} cy={endPos[1]} r="8" fill="#ec4899" />
        <text
          x={endPos[0]}
          y={endPos[1] + 20}
          textAnchor="middle"
          className="text-sm font-bold fill-pink-900"
        >
          目的地
        </text>
      </svg>

      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <span>進度: {Math.round(progress * 100)}%</span>
        <span>距離估計</span>
      </div>
    </motion.div>
  )
}
