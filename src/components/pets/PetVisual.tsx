"use client"

import Image from "next/image"
import { useState } from "react"
import { resolveVisualKey } from "@/server/domain/student-pet-rules"

const SPECIES_EMOJI: Record<string, string> = {
  "cat-orange": "🐱",
  "cat-black": "🐱",
  "cat-white": "🐱",
  "dog-golden": "🐶",
  "dog-husky": "🐶",
  "dog-corgi": "🐶",
  "animal-panda": "🐼",
  "animal-rabbit": "🐰",
  "animal-owl": "🦉",
  "animal-bear": "🐻",
}

function emojiFor(speciesKey: string): string {
  return SPECIES_EMOJI[speciesKey] ?? "🐾"
}

/**
 * 宠物视觉：优先加载 public/pets/<speciesKey>-lv<level>.png，
 * 图片缺失时自动回退到品种 emoji 占位，因此不配置任何资产也能运行。
 * 图片命名约定：`public/pets/<speciesKey>-lv1.png` … `-lv<MAX_PET_LEVEL>.png`
 * （与 PetSpecies.visualSlots / PetView.visualKey 保持一致）。
 */
export function PetVisual({ speciesKey, level, size = "text-6xl" }: { speciesKey: string; level: number; size?: string }) {
  const [failed, setFailed] = useState(false)
  const scale = Math.min(1.35, 0.95 + level * 0.04)
  const key = resolveVisualKey(speciesKey, level)

  return (
    <span
      className={`inline-block leading-none ${size}`}
      style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      role="img"
      aria-label={`${speciesKey} Lv.${level}`}
    >
      {failed ? (
        emojiFor(speciesKey)
      ) : (
        <Image
          src={`/pets/${key}.png`}
          alt={`${speciesKey} Lv.${level}`}
          width={128}
          height={128}
          className="h-[1em] w-[1em] object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}
