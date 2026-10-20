export interface PetView {
  id: string
  name: string
  speciesKey: string
  speciesName: string
  visualKey: string
  growthValue: number
  status: "GROWING" | "GRADUATED"
  adoptionSeq: number
  graduatedAt: string | null
  level: number
  currentThreshold: number
  nextThreshold: number | null
  remainingToNext: number | null
  progressRatio: number
  graduated: boolean
}

export interface ZooItem {
  student: { id: string; name: string; studentNo?: string | null; avatarUrl?: string | null }
  badgeCount: number
  pet: PetView | null
}
