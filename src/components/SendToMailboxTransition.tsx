import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface SendToMailboxTransitionProps {
  visible: boolean
  onComplete: () => void
}

export default function SendToMailboxTransition({ visible, onComplete }: SendToMailboxTransitionProps) {
  useEffect(() => {
    if (!visible) {
      return
    }

    const timer = window.setTimeout(() => {
      onComplete()
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [visible, onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] bg-indigo-950/65 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="relative w-[520px] h-[390px]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-1 left-1/2 -translate-x-1/2 text-white/90 text-sm"
            >
              正在封裝信件...
            </motion.div>

            <div className="absolute inset-x-8 bottom-10 h-[300px] rounded-2xl overflow-hidden bg-yellow-300/90 border border-yellow-200/40">
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.7), rgba(255,255,255,0.7) 4px, transparent 4px, transparent 16px)'
              }} />

              <div className="absolute left-[190px] top-[26px] w-[160px] h-[252px]">
                <div className="absolute left-0 right-0 top-0 h-[72px] bg-sky-500 border-2 border-sky-700 rounded-t-[58px]" />
                <div className="absolute left-[6px] right-[6px] top-[16px] h-[13px] rounded-full bg-sky-900" />
                <div className="absolute left-0 right-0 top-[60px] bottom-[52px] bg-sky-500 border-x-2 border-sky-700" />
                <div className="absolute right-[-18px] top-[88px] w-[70px] h-[16px] bg-white border-2 border-rose-400 rounded-sm">
                  <div className="absolute inset-y-[3px] left-[5px] right-[5px] bg-rose-500" />
                </div>
                <div className="absolute left-[-16px] top-[80px] w-[82px] h-[34px] bg-amber-50 border-2 border-amber-300 rounded-sm flex items-center justify-center">
                  <span className="text-rose-600 font-black text-[19px] tracking-wide">MAIL</span>
                </div>
                <div className="absolute left-[10px] top-[124px] text-sky-900/90 text-[15px] leading-8 font-semibold">
                  <div>NAME_____</div>
                  <div>ADDRESS___</div>
                  <div>CITY_____</div>
                </div>
                <div className="absolute left-[22px] bottom-0 w-[18px] h-[56px] bg-sky-600 border-x-2 border-sky-700" />
                <div className="absolute right-[22px] bottom-0 w-[18px] h-[56px] bg-sky-600 border-x-2 border-sky-700" />
              </div>
            </div>

            <motion.div
              className="absolute left-[86px] top-[166px] w-[162px] h-[102px]"
              initial={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
              animate={{
                x: [0, 64, 140, 188],
                y: [0, -22, -42, -36],
                rotate: [0, -7, 3, 0],
                scale: [1, 0.9, 0.65, 0.35],
                opacity: [1, 1, 1, 0]
              }}
              transition={{ duration: 1.9, times: [0, 0.35, 0.78, 1], ease: 'easeInOut' }}
            >
              <div className="absolute inset-0 bg-amber-50 border-2 border-amber-300 rounded-md shadow-lg" />
              <div className="absolute left-0 right-0 top-0 h-1/2 overflow-hidden rounded-t-md">
                <motion.div
                  className="absolute inset-0 bg-amber-100 border-x-2 border-t-2 border-amber-300"
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: [0, -18, -82] }}
                  transition={{ duration: 0.95, times: [0, 0.35, 1], ease: 'easeInOut' }}
                  style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d' }}
                />
              </div>
              <div className="absolute left-2 right-2 top-1/2 h-[2px] bg-indigo-300/70" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1] }}
              transition={{ duration: 2.2, times: [0, 0.65, 1] }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 text-white/85 text-xs"
            >
              已送入信箱，正在前往解鎖頁...
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
