"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface PlatformStats {
  counts: {
    schools: number
    activeSchools: number
    teachers: number
    classrooms: number
    students: number
    activeStudents30d: number
  }
  sales: {
    paidOrders: number
    totalSeats: number
    totalAmountCents: number
    monthly: Array<{ month: string; seats: number; amountCents: number }>
  }
}

function formatYuan(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function OverviewTab() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<PlatformStats>("/api/v1/admin/stats")
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载运营数据失败")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cards = [
    { label: "学校", value: stats ? `${stats.counts.schools}` : "--", sub: stats ? `活跃 ${stats.counts.activeSchools}` : "", icon: "🏫" },
    { label: "教师", value: stats ? `${stats.counts.teachers}` : "--", sub: "在职教师账号", icon: "👩‍🏫" },
    { label: "班级", value: stats ? `${stats.counts.classrooms}` : "--", sub: "正在使用中", icon: "📋" },
    { label: "学生", value: stats ? `${stats.counts.students}` : "--", sub: stats ? `近30天活跃 ${stats.counts.activeStudents30d}` : "", icon: "🎒" },
    { label: "已售订单", value: stats ? `${stats.sales.paidOrders}` : "--", sub: "已支付订单数", icon: "🧾" },
    { label: "销量份数", value: stats ? `${stats.sales.totalSeats}` : "--", sub: "累计售出座位", icon: "💰" },
  ]

  const maxSeats = Math.max(1, ...(stats?.sales.monthly ?? []).map((m) => m.seats))

  return (
    <div className="space-y-5">
      {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((card, index) => (
          <div key={card.label} className={`sticker sticker-quiet rise-in stagger-${Math.min(index + 1, 8)} p-4`}>
            <div className="text-xs font-semibold tracking-widest text-ink-soft">{card.icon} {card.label}</div>
            <div className="mt-1.5 text-3xl font-bold tabular-nums text-ink">{card.value}</div>
            <div className="mt-0.5 text-xs text-ink-faint">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="sticker sticker-quiet rise-in stagger-4 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">💵</span>累计销售额</h2>
          <span className="text-2xl font-bold tabular-nums text-tangerine-deep">
            {stats ? formatYuan(stats.sales.totalAmountCents) : "--"}
          </span>
        </div>

        <h3 className="font-display mt-5 flex items-center gap-2 text-base font-bold text-ink"><span aria-hidden="true">📊</span>近 6 个月销量（份数）</h3>
        <div className="mt-3 space-y-1.5">
          {(stats?.sales.monthly ?? []).map((month) => (
            <div key={month.month} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 font-semibold tabular-nums text-ink-soft">{month.month}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-ink/15 bg-white">
                <div
                  className="h-full rounded-full bg-tangerine"
                  style={{ width: `${Math.round((month.seats / maxSeats) * 100)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-bold tabular-nums text-ink">{month.seats} 份 · {formatYuan(month.amountCents)}</span>
            </div>
          ))}
          {!stats && <div className="text-sm text-ink-faint">加载中...</div>}
        </div>
      </div>
    </div>
  )
}
