"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { apiRequest } from "@/lib/api-client"

interface LevelConfig {
  level: number
  requiredGrowth: number
}

const LEVEL_PRESETS: Record<string, number[]> = {
  默认: [0, 5, 10, 20, 30, 45, 60, 75, 90, 100],
  宽松: [0, 3, 6, 12, 20, 30, 42, 56, 72, 90],
  严格: [0, 10, 25, 45, 70, 100, 135, 175, 220, 270],
}

export default function SettingsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [config, setConfig] = useState<LevelConfig[]>([])
  const [systemName, setSystemName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiRequest<{ items: LevelConfig[] }>(`/api/v1/classrooms/${classroomId}/pet-level-config`)
      .then((data) => setConfig(data.items))
      .catch(() => setError("加载成长配置失败"))
    apiRequest<{ name: string }>("/api/v1/system-settings")
      .then((data) => setSystemName(data.name))
      .catch(() => undefined)
  }, [classroomId])

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}/pet-level-config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thresholds: config.map((item) => item.requiredGrowth) }),
      })
      if (systemName.trim()) {
        await apiRequest("/api/v1/system-settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: systemName.trim() }),
        })
      }
      setSaved(true)
    } catch {
      setError("保存失败，请检查阈值格式（Lv1 为 0 且逐级递增）")
    } finally {
      setSaving(false)
    }
  }

  function applyPreset(name: keyof typeof LEVEL_PRESETS) {
    setConfig(LEVEL_PRESETS[name].map((requiredGrowth, index) => ({ level: index + 1, requiredGrowth })))
  }

  function updateThreshold(level: number, value: number) {
    setConfig((items) => items.map((item) => (item.level === level ? { ...item, requiredGrowth: value } : item)))
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">系统设置</h1>
            <p className="text-slate-600">自定义宠物成长阈值与全局系统名称。</p>
          </div>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={saving} onClick={save}>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
        {saved ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">设置已保存</div> : null}

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">1~10 级成长阈值（累计食物）</h2>
              <p className="mt-1 text-sm text-slate-500">宠物满级（Lv.10）毕业自动获得徽章。</p>
            </div>
            <div className="flex gap-2">
              {(Object.keys(LEVEL_PRESETS) as Array<keyof typeof LEVEL_PRESETS>).map((name) => (
                <button key={name} className="rounded-full border px-3 py-1 text-sm text-slate-600 hover:bg-slate-50" onClick={() => applyPreset(name)}>
                  {name}档
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {config.map((item) => (
              <label key={item.level} className="block rounded-lg border p-3">
                <span className="text-xs font-medium text-slate-500">Lv.{item.level}</span>
                <input
                  type="number"
                  min={0}
                  disabled={item.level === 1}
                  value={item.requiredGrowth}
                  onChange={(event) => updateThreshold(item.level, Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-sm disabled:bg-slate-50"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold">全局系统名称</h2>
          <p className="mt-1 text-sm text-slate-500">显示在首页与班级大屏的系统名称（默认：班级动物园）。</p>
          <input value={systemName} onChange={(event) => setSystemName(event.target.value)} className="mt-3 w-full max-w-md rounded-lg border px-3 py-2" />
        </section>
      </div>
    </AppShell>
  )
}
