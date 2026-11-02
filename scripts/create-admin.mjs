// 创建（或重置）平台管理员账号。幂等：重复执行同一邮箱 = 重置密码。
//
// 用法（容器内）：
//   docker compose run --rm migrate node scripts/create-admin.mjs <email> <password>
// 或用环境变量：
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... docker compose run --rm migrate node scripts/create-admin.mjs
//
// 密码算法与 src/server/auth/password.ts 保持一致（scrypt, 16B salt, 64B hash）。
import { randomBytes, scryptSync } from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function hashPassword(password) {
  const passwordSalt = randomBytes(16).toString("hex")
  const passwordHash = scryptSync(password, passwordSalt, 64).toString("hex")
  return { passwordHash, passwordSalt }
}

async function main() {
  const [argEmail, argPassword] = process.argv.slice(2)
  const email = (argEmail || process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  const password = argPassword || process.env.ADMIN_PASSWORD || ""
  const name = (process.env.ADMIN_NAME || "平台管理员").trim()

  if (!email) {
    throw new Error("用法: node scripts/create-admin.mjs <email> <password>（或 ADMIN_EMAIL / ADMIN_PASSWORD 环境变量）")
  }
  if (password.length < 8) {
    throw new Error("密码至少 8 位，请使用强随机密码")
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    include: { credentials: true },
  })

  if (existing && existing.role !== "ADMIN") {
    throw new Error(`${email} 已存在且角色是 ${existing.role}（教师/学生/家长），请为管理员使用独立邮箱`)
  }

  const { passwordHash, passwordSalt } = hashPassword(password)

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { status: "ACTIVE" } })
    : await prisma.user.create({ data: { name, email, role: "ADMIN", status: "ACTIVE" } })

  // 幂等：重建凭据（重复执行 = 重置密码）。
  if (existing && existing.credentials.length > 0) {
    await prisma.passwordCredential.deleteMany({ where: { userId: user.id } })
  }
  await prisma.passwordCredential.create({
    data: { userId: user.id, passwordHash, passwordSalt, requireReset: false },
  })

  console.log(`✅ 管理员就绪：${email}（${existing ? "已重置密码" : "新创建"}）`)
  console.log("登录方式：登录页切换到「🛠️ 管理员」，用该邮箱和密码登录，落地 /admin。")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(`❌ ${error.message}`)
    await prisma.$disconnect()
    process.exit(1)
  })
