import { useState } from 'react'

interface LetterData {
  senderName: string
  senderCity: string
  recipientName: string
  recipientCity: string
  scheduledTime: string
  estimatedDays: number
  letterContent: string
}

const CITIES = [
  '台北', '台中', '高雄', '台南',
  '東京', '大阪', '京都', '橫濱',
  '首爾', '釜山',
  '曼谷', '清邁',
  '新加坡',
  '香港',
  '上海', '北京'
]

interface Props {
  onStart: (data: LetterData) => void
}

export default function LetterSetup({ onStart }: Props) {
  const [data, setData] = useState<LetterData>({
    senderName: '',
    senderCity: '台北',
    recipientName: '',
    recipientCity: '東京',
    scheduledTime: new Date().toISOString().slice(0, 16),
    estimatedDays: 5,
    letterContent: ''
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setData(prev => ({
      ...prev,
      [name]: name === 'estimatedDays' ? parseInt(value) : value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (data.senderName && data.recipientName) {
      onStart(data)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-indigo-200">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sender Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-indigo-900">寄件方</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                你的名字
              </label>
              <input
                type="text"
                name="senderName"
                value={data.senderName}
                onChange={handleChange}
                placeholder="例：小王"
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                你的城市
              </label>
              <select
                name="senderCity"
                value={data.senderCity}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
              >
                {CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recipient Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-indigo-900">收件方</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                筆友的名字
              </label>
              <input
                type="text"
                name="recipientName"
                value={data.recipientName}
                onChange={handleChange}
                placeholder="例：小李"
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                筆友的城市
              </label>
              <select
                name="recipientCity"
                value={data.recipientCity}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50"
              >
                {CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="bg-indigo-50 p-6 rounded-xl space-y-4 border-2 border-indigo-200">
          <h3 className="text-xl font-bold text-indigo-900">📬 寄送設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                排程寄送時間
              </label>
              <input
                type="datetime-local"
                name="scheduledTime"
                value={data.scheduledTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                預計送達天數
              </label>
              <input
                type="number"
                name="estimatedDays"
                value={data.estimatedDays}
                onChange={handleChange}
                min="1"
                max="30"
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Letter Content */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            信件備註（可選）
          </label>
          <textarea
            name="letterContent"
            value={data.letterContent}
            onChange={handleChange}
            placeholder="寫下對筆友的留言..."
            rows={4}
            className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 bg-indigo-50 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-lg"
        >
          🚀 開始追蹤
        </button>
      </form>
    </div>
  )
}
