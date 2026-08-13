"use client"

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

// 依次探测的图片格式：先 png，缺失时自动尝试 jpg / webp，全部缺失才回退 emoji。
const IMAGE_EXTENSIONS = ["png", "jpg", "webp"] as const

/**
 * 宠物视觉：直接读取 public/pets/<speciesKey>-lv<level>.<ext>，
 * 绕过 next/image 优化器（容器/代理下更稳），并支持 png/jpg/webp 自动探测。
 * 图片缺失时回退到品种 emoji 占位，因此不配置任何资产也能运行。
 * 命名约定：`public/pets/<speciesKey>-lv1.png` … `-lv<MAX_PET_LEVEL>.png`。
 */
export function PetVisual({ speciesKey, level, size = "text-6xl" }: { speciesKey: string; level: number; size?: string }) {
  const [extensionIndex, setExtensionIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const scale = Math.min(1.35, 0.95 + level * 0.04)
  const key = resolveVisualKey(speciesKey, level)

  if (failed) {
    return (
      <span
        className={`inline-block leading-none ${size}`}
        style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        role="img"
        aria-label={`${speciesKey} Lv.${level}`}
      >
        {emojiFor(speciesKey)}
      </span>
    )
  }

  const src = `/pets/${key}.${IMAGE_EXTENSIONS[extensionIndex]}`

  return (
    <span
      className={`inline-block leading-none ${size}`}
      style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      role="img"
      aria-label={`${speciesKey} Lv.${level}`}
    >
      {/* 直接用 img 读取 public/，避免 next/image 优化器在容器环境下 404 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${speciesKey} Lv.${level}`}
        className="h-[1em] w-[1em] object-contain"
        onError={() => {
          if (extensionIndex < IMAGE_EXTENSIONS.length - 1) {
            setExtensionIndex((current) => current + 1)
          } else {
            setFailed(true)
          }
        }}
      />
    </span>
  )
}
