import Link from "next/link"

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="rise-in sticker w-full max-w-md p-8 text-center">
        <span aria-hidden="true" className="inline-block text-6xl">🚧</span>
        <h1 className="font-display mt-4 text-2xl font-bold text-ink">无权访问</h1>
        <p className="mt-2 text-ink-soft">当前账号没有访问该页面的权限。</p>
        <Link href="/" className="btn-tangerine mt-6">
          返回首页
        </Link>
      </div>
    </main>
  )
}
