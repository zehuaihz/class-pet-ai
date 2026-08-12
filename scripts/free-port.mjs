import { execFileSync } from "node:child_process"

const PORT = 3000

function listeningPids() {
  try {
    const out = execFileSync("lsof", ["-tiTCP:" + PORT, "-sTCP:LISTEN"], { encoding: "utf8" }).trim()
    return out ? out.split("\n").map((line) => line.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function processCommand(pid) {
  try {
    return execFileSync("ps", ["-p", pid, "-o", "command="], { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

function processParent(pid) {
  try {
    return execFileSync("ps", ["-p", pid, "-o", "ppid="], { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}

function isProjectNextServer(pid) {
  const chain = [pid]
  let current = pid
  for (let depth = 0; depth < 5; depth++) {
    const parent = processParent(current)
    if (!parent || parent === "0" || parent === "1" || chain.includes(parent)) break
    chain.push(parent)
    current = parent
  }
  const combined = chain.map((p) => processCommand(p)).join(" ")
  return combined.includes("class-pet-ai") && combined.includes("next")
}

const pids = listeningPids()

if (pids.length === 0) {
  process.exit(0)
}

let freed = false
for (const pid of pids) {
  if (isProjectNextServer(pid)) {
    try {
      process.kill(Number(pid), "SIGTERM")
      console.log(`[free-port] 释放残留的 dev server (PID ${pid})`)
      freed = true
    } catch {
      console.error(`[free-port] 无法终止 PID ${pid}`)
      process.exit(1)
    }
  }
}

if (!freed) {
  console.error(`[free-port] 端口 ${PORT} 被其他进程占用：${pids.map((pid) => `${pid} (${processCommand(pid)})`).join(", ")}`)
  console.error(`[free-port] 请先手动释放该端口，或改用 -p 指定其他端口。`)
  process.exit(1)
}
