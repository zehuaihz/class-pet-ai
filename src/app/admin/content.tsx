"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/AppShell"
import OverviewTab from "./overview-tab"
import UsersTab from "./users-tab"
import SchoolsTab from "./schools-tab"
import ClassroomsTab from "./classrooms-tab"
import SalesTab from "./sales-tab"

type TabKey = "overview" | "users" | "schools" | "classrooms" | "sales"

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "📈 概览" },
  { key: "users", label: "👥 用户" },
  { key: "schools", label: "🏫 学校" },
  { key: "classrooms", label: "📋 班级" },
  { key: "sales", label: "💰 销量" },
]

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("overview")

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="font-display rise-in flex items-center gap-2 text-3xl font-bold text-ink">
          <span aria-hidden="true">🛠️</span>管理后台
        </h1>

        <nav className="sticker sticker-quiet rise-in stagger-1 flex flex-wrap gap-2 p-2" aria-label="管理后台功能">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={`rounded-xl border-2 px-4 py-1.5 text-sm font-bold transition ${
                tab === item.key
                  ? "border-ink bg-butter text-ink shadow-[3px_3px_0_0_rgba(28,25,23,0.25)]"
                  : "border-ink/15 bg-white text-ink-soft hover:border-ink/40"
              }`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "users" ? <UsersTab /> : null}
        {tab === "schools" ? <SchoolsTab /> : null}
        {tab === "classrooms" ? <ClassroomsTab /> : null}
        {tab === "sales" ? <SalesTab /> : null}
      </div>
    </AppShell>
  )
}
