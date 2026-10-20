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
        className="flex h-full min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center text-slate-400 transition hover:border-green-300 hover:bg-green-50"
      >
        <span className="text-5xl">🐾</span>
        <div className="mt-3 font-medium">{studentName}</div>
        <div className="mt-1 text-sm">未分配宠物</div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col rounded-xl border p-4 text-left transition hover:border-green-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{studentName}</div>
          <div className="mt-0.5 text-sm text-slate-500">{pet.speciesName}</div>
        </div>
        <div className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          Lv.{pet.level}
        </div>
      </div>

      <div className="mt-3 flex flex-1 items-center justify-center py-2">
        <PetVisual speciesKey={pet.speciesKey} level={pet.level} size="text-6xl" />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{pet.graduated ? "已毕业 🎓" : `累计食物 ${pet.growthValue}`}</span>
          <span>{pet.nextThreshold != null ? `距离 Lv.${pet.level + 1} 还差 ${pet.remainingToNext}` : ""}</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all"
            style={{ width: `${Math.round((pet.progressRatio ?? 0) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-amber-600">🏅 徽章 {badgeCount}</span>
          {pet.graduated ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">领养新宠物 →</span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
