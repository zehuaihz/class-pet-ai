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
  默认: [0, 10, 30, 60],
  宽松: [0, 5, 15, 30],
  严格: [0, 20, 50, 100],
}

export default function SettingsPage() {
  const params = useParams<{ classroomId: string }>()
  const classroomId = params.classroomId ?? "1"
  const [config, setConfig] = useState<LevelConfig[]>([])
  const [systemName, setSystemName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [classroom, setClassroom] = useState({ name: "", grade: "", schoolName: "" })
  const [classSaving, setClassSaving] = useState(false)
  const [classSaved, setClassSaved] = useState(false)

  useEffect(() => {
    apiRequest<{ items: LevelConfig[] }>(`/api/v1/classrooms/${classroomId}/pet-level-config`)
      .then((data) => setConfig(data.items))
      .catch(() => setError("加载成长配置失败"))
    apiRequest<{ name: string }>("/api/v1/system-settings")
      .then((data) => setSystemName(data.name))
      .catch(() => undefined)
    // 班级信息（班级名/年级/学校名称）。
    apiRequest<{ name: string; grade: string | null; schoolName: string | null }>(`/api/v1/classrooms/${classroomId}`)
      .then((data) => setClassroom({ name: data.name, grade: data.grade ?? "", schoolName: data.schoolName ?? "" }))
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

  async function saveClassInfo() {
    setClassSaving(true)
    setError(null)
    setClassSaved(false)
    try {
      await apiRequest(`/api/v1/classrooms/${classroomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: classroom.name.trim(),
          grade: classroom.grade.trim() || null,
          schoolName: classroom.schoolName.trim() || null,
        }),
      })
      setClassSaved(true)
    } catch {
      setError("保存班级信息失败")
    } finally {
      setClassSaving(false)
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
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rise-in flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink"><span aria-hidden="true">⚙️</span>系统设置</h1>
            <p className="mt-1 text-sm text-ink-soft">自定义宠物成长阈值与全局系统名称。</p>
          </div>
          <button className="btn-tangerine disabled:opacity-40" disabled={saving} onClick={save}>
            {saving ? "保存中..." : "💾 保存设置"}
          </button>
        </div>

        {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
        {saved ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">✅ 设置已保存</div> : null}

        <section className="sticker sticker-quiet rise-in stagger-2 p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">📖</span>设置说明</h2>
          <p className="mt-1 text-sm text-ink-soft">设置页保留班级信息、成长阈值与系统名称配置。</p>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🏫</span>班级信息</h2>
              <p className="mt-1 text-sm text-ink-soft">修改班级名称、年级与学校名称。</p>
            </div>
            {classSaved ? <span className="rounded-full border-2 border-forest bg-forest-mist px-2.5 py-0.5 text-xs font-bold text-forest-deep">已保存</span> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold text-ink-soft">班级名</span>
              <input value={classroom.name} onChange={(event) => setClassroom({ ...classroom, name: event.target.value })} className="sticker-input mt-1 w-full" placeholder="如：三年级2班" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-soft">年级</span>
              <input value={classroom.grade} onChange={(event) => setClassroom({ ...classroom, grade: event.target.value })} className="sticker-input mt-1 w-full" placeholder="如：3" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-soft">学校名称</span>
              <input value={classroom.schoolName} onChange={(event) => setClassroom({ ...classroom, schoolName: event.target.value })} className="sticker-input mt-1 w-full" placeholder="如：测试小学" />
            </label>
          </div>
          <button className="btn-ink mt-4 disabled:opacity-40" disabled={classSaving || !classroom.name.trim()} onClick={saveClassInfo}>
            {classSaving ? "保存中..." : "保存班级信息"}
          </button>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🌱</span>成长阈值（累计食物，满级毕业）</h2>
              <p className="mt-1 text-sm text-ink-soft">宠物满级毕业自动获得徽章；等级数由阈值条目数决定。</p>
            </div>
            <div className="flex gap-2">
              {(Object.keys(LEVEL_PRESETS) as Array<keyof typeof LEVEL_PRESETS>).map((name) => (
                <button key={name} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-semibold text-ink transition hover:bg-butter" onClick={() => applyPreset(name)}>
                  {name}档
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {config.map((item) => (
              <label key={item.level} className="block rounded-xl border-2 border-ink/15 bg-white p-3">
                <span className="font-display text-sm font-bold text-ink">Lv.{item.level}</span>
                <input
                  type="number"
                  min={0}
                  disabled={item.level === 1}
                  value={item.requiredGrowth}
                  onChange={(event) => updateThreshold(item.level, Number(event.target.value))}
                  className="sticker-input mt-1 w-full !px-2 !py-1 text-sm disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="sticker sticker-quiet rise-in stagger-5 p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🏷️</span>全局系统名称</h2>
          <p className="mt-1 text-sm text-ink-soft">显示在首页与班级大屏的系统名称（默认：班级动物园）。</p>
          <input value={systemName} onChange={(event) => setSystemName(event.target.value)} className="sticker-input mt-3 w-full max-w-md" />
        </section>
      </div>
    </AppShell>
  )
}
