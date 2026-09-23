import Link from "next/link"

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">无权访问</h1>
        <p className="mt-2 text-slate-600">当前账号没有访问该页面的权限。</p>
        <Link href="/" className="mt-5 inline-block rounded-lg bg-green-600 px-4 py-2 text-white">
          返回首页
        </Link>
      </div>
    </main>
  )
}
