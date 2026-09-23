"use client"

import { FormEvent, useEffect, useState } from "react"

export interface RewardItemFormValues {
  name: string
  description: string
  costPoints: number
  stock: string
  enabled: boolean
}

export interface RewardItemFormProps {
  initialValues?: Partial<RewardItemFormValues>
  submitLabel: string
  disabled?: boolean
  onSubmit: (values: { name: string; description?: string; costPoints: number; stock: number | null; enabled: boolean }) => Promise<void>
  onCancel?: () => void
}

const EMPTY: RewardItemFormValues = { name: "", description: "", costPoints: 10, stock: "", enabled: true }

export function RewardItemForm({ initialValues, submitLabel, disabled, onSubmit, onCancel }: RewardItemFormProps) {
  const [values, setValues] = useState<RewardItemFormValues>({ ...EMPTY, ...initialValues })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues({ ...EMPTY, ...initialValues })
  }, [initialValues])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = values.name.trim()
    if (!name) {
      setError("请填写奖励名称")
      return
    }
    if (!Number.isInteger(values.costPoints) || values.costPoints < 1) {
      setError("所需积分必须是不小于 1 的整数")
      return
    }
    const stockText = values.stock.trim()
    const stock = stockText === "" ? null : Number(stockText)
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
      setError("库存必须是不小于 0 的整数，留空表示无限")
      return
    }

    setError(null)
    await onSubmit({
      name,
      description: values.description.trim() || undefined,
      costPoints: values.costPoints,
      stock,
      enabled: values.enabled,
    })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm md:col-span-2">
          <span className="text-slate-600">名称</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">所需积分</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={values.costPoints}
            onChange={(event) => setValues((current) => ({ ...current, costPoints: Number(event.target.value) }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">库存（留空为无限）</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={values.stock}
            onChange={(event) => setValues((current) => ({ ...current, stock: event.target.value }))}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-slate-600">描述</span>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.enabled}
          onChange={(event) => setValues((current) => ({ ...current, enabled: event.target.checked }))}
        />
        <span className="text-slate-600">上架（学生可见）</span>
      </label>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex gap-2">
        <button className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50" disabled={disabled}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="rounded-lg border px-4 py-2" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </div>
    </form>
  )
}
