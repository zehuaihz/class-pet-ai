"use client"

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

/** 占位视觉：品种 emoji + 等级。真实 3D 资产就绪后替换为图片插槽。 */
export function PetVisual({ speciesKey, level, size = "text-6xl" }: { speciesKey: string; level: number; size?: string }) {
  const scale = Math.min(1.35, 0.95 + level * 0.04)
  return (
    <span
      className={`inline-block leading-none ${size}`}
      style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      aria-label={`${speciesKey} Lv.${level}`}
      role="img"
    >
      {emojiFor(speciesKey)}
    </span>
  )
}
