"use client"

import { FormEvent, useEffect, useState } from "react"

export interface RewardItemFormValues {
  name: string
  description: string
  costBadges: number
  stock: string
  enabled: boolean
}

export interface RewardItemFormProps {
  initialValues?: Partial<RewardItemFormValues>
  submitLabel: string
  disabled?: boolean
  onSubmit: (values: { name: string; description?: string; costBadges: number; stock: number | null; enabled: boolean }) => Promise<void>
  onCancel?: () => void
}

const EMPTY: RewardItemFormValues = { name: "", description: "", costBadges: 10, stock: "", enabled: true }

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
    if (!Number.isInteger(values.costBadges) || values.costBadges < 1) {
      setError("所需徽章必须是不小于 1 的整数")
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
      costBadges: values.costBadges,
      stock,
      enabled: values.enabled,
    })
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm md:col-span-2">
          <span className="font-semibold text-ink-soft">名称</span>
          <input
            className="sticker-input mt-1 w-full"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-ink-soft">所需徽章</span>
          <input
            type="number"
            min={1}
            className="sticker-input mt-1 w-full"
            value={values.costBadges}
            onChange={(event) => setValues((current) => ({ ...current, costBadges: Number(event.target.value) }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-ink-soft">库存（留空为无限）</span>
          <input
            type="number"
            min={0}
            className="sticker-input mt-1 w-full"
            value={values.stock}
            onChange={(event) => setValues((current) => ({ ...current, stock: event.target.value }))}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-semibold text-ink-soft">描述</span>
        <input
          className="sticker-input mt-1 w-full"
          value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#2F7D4F]"
          checked={values.enabled}
          onChange={(event) => setValues((current) => ({ ...current, enabled: event.target.checked }))}
        />
        <span className="font-semibold text-ink-soft">上架（学生可见）</span>
      </label>

      {error ? <div className="sticker-tight !border-berry bg-berry-soft p-2 text-sm font-semibold text-berry">{error}</div> : null}

      <div className="flex gap-2">
        <button className="btn-tangerine disabled:opacity-40" disabled={disabled}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-outline" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </div>
    </form>
  )
}
