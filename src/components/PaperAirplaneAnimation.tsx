import { motion } from 'framer-motion'

interface Props {
  progress: number
}

export default function PaperAirplaneAnimation({ progress }: Props) {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 100)) : 0

  // Bezier curve control points
  const startX = 30
  const startY = 100
  const endX = 370
  const endY = 100
  const controlX = 200
  const controlY = 20

  // Calculate position along bezier curve
  const getPositionOnCurve = (t: number) => {
    const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX
    const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY
    return { x, y }
  }

  const pos = getPositionOnCurve(safeProgress / 100)

  return (
    <div className="w-full bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl p-8">
      <svg viewBox="0 0 400 160" className="w-full h-auto" style={{ minHeight: '160px' }}>
        {/* Dashed curve path */}
        <path
          d={`M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`}
          stroke="#a5b4fc"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
          opacity="0.6"
        />

        {/* Start point - pin marker */}
        <g>
          <circle cx={startX} cy={startY} r="10" fill="#6366f1" />
          <circle cx={startX} cy={startY} r="4" fill="#e0e7ff" />
          <path
            d={`M ${startX} ${startY + 10} L ${startX - 4} ${startY + 20} L ${startX} ${startY + 17} L ${startX + 4} ${startY + 20} Z`}
            fill="#4f46e5"
          />
        </g>

        {/* End point - rotating earth with continents */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          style={{ transformOrigin: '370px 100px' }}
        >
          {/* Ocean/water - light blue circle */}
          <circle
            cx="370"
            cy="100"
            r="16"
            fill="#4fa3d1"
            stroke="#2d7fa3"
            strokeWidth="0.5"
          />

          {/* Continents - yellow green */}
          <g fill="#c4d96f">
            {/* North America */}
            <path d="M 361 92 L 362 88 L 365 89 L 365 95 L 361 95 Z" />

            {/* South America */}
            <path d="M 361 96 L 362 105 L 364 107 L 363 100 Z" />

            {/* Africa/Europe */}
            <path d="M 367 94 L 372 90 L 375 92 L 378 96 L 377 103 L 373 105 L 369 103 Z" />

            {/* Asia */}
            <path d="M 373 85 L 378 84 L 382 88 L 380 94 L 375 92 Z" />

            {/* Australia */}
            <ellipse cx="381" cy="105" rx="2.5" ry="3" />
          </g>

          {/* Subtle atmosphere glow */}
          <circle
            cx="370"
            cy="100"
            r="16"
            fill="none"
            stroke="#4fa3d1"
            strokeWidth="1"
            opacity="0.2"
          />

          {/* Outer glow */}
          <circle
            cx="370"
            cy="100"
            r="16.5"
            fill="none"
            stroke="#a3d5e8"
            strokeWidth="0.5"
            opacity="0.3"
          />
        </motion.g>

        {/* Letter icon floating along the path (rendered on top to avoid overlap) */}
        <g transform={`translate(${pos.x}, ${pos.y})`}>
          <motion.text
            animate={{ y: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            x="0"
            y="0"
            fontSize="30"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ✉️
          </motion.text>
        </g>

        {/* Progress percentage text */}
        <text
          x="200"
          y="155"
          textAnchor="middle"
          className="text-xs fill-gray-600"
          fontSize="12"
          fontWeight="500"
        >
          信件進度: {Math.round(safeProgress)}%
        </text>
      </svg>
    </div>
  )
}
