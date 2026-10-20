"use client"

import { useEffect } from "react"

interface LevelUpModalProps {
  open: boolean
  petName: string
  newLevel: number
  graduated: boolean
  onClose: () => void
}

const STAR_POSITIONS = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 7.3) % 100}%`,
  top: `${(index * 13.7) % 80}%`,
  delay: `${(index % 7) * 0.12}s`,
}))

/** 升级/毕业庆祝弹窗：星光特效占位动画。 */
export function LevelUpModal({ open, petName, newLevel, graduated, onClose }: LevelUpModalProps) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(onClose, 2600)
    return () => window.clearTimeout(timer)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <style>{`
        @keyframes zoo-star-pop {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          40% { transform: scale(1.3) rotate(45deg); opacity: 1; }
          100% { transform: scale(0.4) rotate(180deg); opacity: 0; }
        }
        @keyframes zoo-bounce-in {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl" style={{ animation: "zoo-bounce-in 0.45s ease-out" }}>
        {STAR_POSITIONS.map((position, index) => (
          <span
            key={index}
            className="pointer-events-none absolute text-2xl"
            style={{ left: position.left, top: position.top, animation: "zoo-star-pop 1.6s ease-out forwards", animationDelay: position.delay }}
          >
            ✨
          </span>
        ))}
        <div className="text-6xl">{graduated ? "🎓" : "🎉"}</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          {graduated ? "养成毕业啦！" : "升级啦！"}
        </h2>
        <p className="mt-2 text-slate-600">
          {petName} 升到 <span className="font-bold text-green-600">Lv.{newLevel}</span>
          {graduated ? "，获得 1 枚专属徽章 🏅" : "，继续加油！"}
        </p>
      </div>
    </div>
  )
}
