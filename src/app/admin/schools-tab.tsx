"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface School {
  id: string
  name: string
  status: string
  contactName: string | null
  contactPhone: string | null
  createdAt: string
  teacherCount: number
  subscriptionCount: number
}

const EMPTY_FORM = { name: "", contactName: "", contactPhone: "" }

export default function SchoolsTab() {
  const [schools, setSchools] = useState<School[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: School[] }>("/api/v1/admin/schools")
      setSchools(data.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载学校列表失败")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createSchool(event: React.FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest("/api/v1/admin/schools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactName: form.contactName.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
        }),
      })
      setNotice(`✅ 学校「${form.name.trim()}」已创建`)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建学校失败")
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(school: School) {
    setBusyId(school.id)
    setError(null)
    setNotice(null)
    try {
      const next = school.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
      await apiRequest(`/api/v1/admin/schools/${school.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      setNotice(`「${school.name}」已${next === "SUSPENDED" ? "停用" : "启用"}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改学校状态失败")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="sticker sticker-quiet !border-berry bg-berry-soft p-3 text-sm font-semibold text-berry">{error}</div> : null}
      {notice ? <div className="sticker sticker-quiet !border-forest bg-forest-mist p-3 text-sm font-semibold text-forest-deep">{notice}</div> : null}

      <section className="sticker sticker-quiet rise-in stagger-1 p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink"><span aria-hidden="true">🏫</span>新增学校</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={createSchool}>
          <label className="text-sm md:col-span-1">
            <span className="font-semibold text-ink-soft">学校名称 *</span>
            <input className="sticker-input mt-1 w-full" required maxLength={100} value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="示例实验小学" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">联系人</span>
            <input className="sticker-input mt-1 w-full" maxLength={50} value={form.contactName}
              onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} placeholder="王主任" />
          </label>
          <label className="text-sm">
            <span className="font-semibold text-ink-soft">联系电话</span>
            <input className="sticker-input mt-1 w-full" maxLength={30} value={form.contactPhone}
              onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} placeholder="138xxxx" />
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="btn-ink disabled:opacity-40" disabled={creating || !form.name.trim()}>
              {creating ? "创建中..." : "✅ 创建学校"}
            </button>
          </div>
        </form>
      </section>

      {schools.length === 0 ? <div className="sticker sticker-quiet p-8 text-center text-ink-soft">还没有学校，先创建一所</div> : null}

      {schools.length > 0 ? (
        <div className="sticker sticker-quiet rise-in stagger-3 overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="font-display text-ink-soft">
                <th className="py-2">学校</th>
                <th>联系人</th>
                <th>教师数</th>
                <th>订单数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-t-2 border-dashed border-ink/20">
                  <td className="py-2.5 font-semibold text-ink">{school.name}</td>
                  <td className="text-ink-soft">{school.contactName ?? "-"}{school.contactPhone ? ` · ${school.contactPhone}` : ""}</td>
                  <td className="font-bold tabular-nums text-ink">{school.teacherCount}</td>
                  <td className="font-bold tabular-nums text-ink">{school.subscriptionCount}</td>
                  <td>
                    <span className={`inline-block rounded-full border-2 px-2 py-0.5 text-xs font-bold ${school.status === "ACTIVE" ? "border-forest bg-forest-mist text-forest-deep" : "border-berry bg-berry-soft text-berry"}`}>{school.status === "ACTIVE" ? "使用中" : "已停用"}</span>
                  </td>
                  <td>
                    <button className="btn-outline !px-3 !py-0.5 text-xs disabled:opacity-40" disabled={busyId === school.id}
                      onClick={() => toggleStatus(school)}>
                      {busyId === school.id ? "处理中..." : school.status === "ACTIVE" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
