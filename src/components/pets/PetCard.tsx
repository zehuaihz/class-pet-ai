"use client"

import { PetVisual } from "@/components/pets/PetVisual"
import type { PetView } from "@/lib/zoo-types"

interface PetCardProps {
  studentName: string
  badgeCount: number
  pet: PetView | null
  onClick?: () => void
}

export function PetCard({ studentName, badgeCount, pet, onClick }: PetCardProps) {
  if (!pet) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex h-full min-h-56 w-full flex-col items-center justify-center rounded-sticker border-2 border-dashed border-ink/35 bg-paper-deep/40 p-4 text-center transition hover:border-ink hover:bg-butter-soft"
      >
        <span aria-hidden="true" className="text-5xl opacity-60 transition-transform group-hover:scale-110">🐾</span>
        <div className="font-display mt-3 text-lg font-bold text-ink">{studentName}</div>
        <div className="mt-1 text-sm text-ink-faint">还没有宠物，点这里分配</div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="sticker sticker-hover group flex h-full w-full flex-col p-4 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display truncate text-lg font-bold text-ink">{studentName}</div>
          <div className="mt-0.5 text-sm text-ink-soft">{pet.speciesName}</div>
        </div>
        <div className="sticker-dot shrink-0 !h-7 !w-auto bg-butter px-2 text-sm">
          Lv.{pet.level}
        </div>
      </div>

      <div className="mt-2 flex flex-1 items-center justify-center py-2">
        <div className={pet.graduated ? "animate-floaty" : "wiggle-hover"}>
          <PetVisual speciesKey={pet.speciesKey} level={pet.level} size="text-6xl" />
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
          <span>{pet.graduated ? "🎓 已毕业" : `累计食物 ${pet.growthValue}`}</span>
          <span>{pet.nextThreshold != null ? `距 Lv.${pet.level + 1} 还差 ${pet.remainingToNext}` : ""}</span>
        </div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-ink bg-paper-deep">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${Math.round((pet.progressRatio ?? 0) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1 text-tangerine">🏅 徽章 {badgeCount}</span>
          {pet.graduated ? (
            <span className="rounded-full border-2 border-ink bg-butter px-2 py-0.5 text-ink">领养新宠物 →</span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
