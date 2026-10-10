import { execFile } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Plugin } from "@opencode/plugin"

const STATE = join(dirname(fileURLToPath(import.meta.url)), "state.json")

type Messages = {
  readyTitle: string
  readyFallback: string
  errorTitle: string
  errorFallback: string
  permissionTitle: string
  permissionBody: string
}

const STRINGS: Record<string, Messages> = {
  en: {
    readyTitle: "OpenCode · done",
    readyFallback: "Task ready, check the terminal",
    errorTitle: "OpenCode · error",
    errorFallback: "Something failed",
    permissionTitle: "OpenCode · permission",
    permissionBody: "The AI needs your approval",
  },
  es: {
    readyTitle: "OpenCode · listo",
    readyFallback: "Tarea lista, revisa el terminal",
    errorTitle: "OpenCode · error",
    errorFallback: "Algo falló",
    permissionTitle: "OpenCode · permiso",
    permissionBody: "La IA necesita tu aprobación",
  },
  fr: {
    readyTitle: "OpenCode · terminé",
    readyFallback: "Tâche terminée, vérifiez le terminal",
    errorTitle: "OpenCode · erreur",
    errorFallback: "Quelque chose a échoué",
    permissionTitle: "OpenCode · autorisation",
    permissionBody: "L'IA a besoin de votre approbation",
  },
  de: {
    readyTitle: "OpenCode · fertig",
    readyFallback: "Aufgabe bereit, Terminal prüfen",
    errorTitle: "OpenCode · Fehler",
    errorFallback: "Etwas ist fehlgeschlagen",
    permissionTitle: "OpenCode · Berechtigung",
    permissionBody: "Die KI braucht deine Zustimmung",
  },
  pt: {
    readyTitle: "OpenCode · pronto",
    readyFallback: "Tarefa pronta, verifique o terminal",
    errorTitle: "OpenCode · erro",
    errorFallback: "Algo falhou",
    permissionTitle: "OpenCode · permissão",
    permissionBody: "A IA precisa da sua aprovação",
  },
  it: {
    readyTitle: "OpenCode · pronto",
    readyFallback: "Attività completata, controlla il terminale",
    errorTitle: "OpenCode · errore",
    errorFallback: "Qualcosa è andato storto",
    permissionTitle: "OpenCode · permesso",
    permissionBody: "L'IA ha bisogno della tua approvazione",
  },
}

function getLang(): string {
  const raw =
    Intl.DateTimeFormat().resolvedOptions().locale ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANG ||
    process.env.LANGUAGE ||
    "en"
  const base = raw.split(/[;:]/)[0].split(/[-_.@]/)[0].toLowerCase()
  if (!base || base === "c" || base === "posix") return "en"
  return base
}

function t(): Messages {
  return STRINGS[getLang()] ?? STRINGS.en!
}

function claim(key: string, windowMs: number): boolean {
  const now = Date.now()
  const owner = Math.random().toString(36).slice(2)
  let state: Record<string, { at: number; owner: string }> = {}
  try {
    state = JSON.parse(readFileSync(STATE, "utf8"))
  } catch {}
  const prev = state[key]
  if (prev && now - prev.at < windowMs) return false
  const fresh: Record<string, { at: number; owner: string }> = {}
  for (const [k, v] of Object.entries(state)) {
    if (now - v.at < 5 * 60_000) fresh[k] = v
  }
  fresh[key] = { at: now, owner }
  try {
    writeFileSync(STATE, JSON.stringify(fresh))
  } catch {
    return false
  }
  try {
    const back = JSON.parse(readFileSync(STATE, "utf8")) as typeof fresh
    return back[key]?.owner === owner
  } catch {
    return false
  }
}

function toast(title: string, body: string) {
  const q = (s: string) => s.replace(/'/g, "''").slice(0, 200)
  const script = `New-BurntToastNotification -Text '${q(title)}','${q(body)}'`
  execFile(
    "powershell.exe",
    ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
    { windowsHide: true } as object,
    (err) => {
      if (err) console.error("[win-toast] toast failed:", err.message)
    },
  )
}

export default Plugin.define({
  id: "opencode-win-toast",
  async setup(ctx) {
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            const type = (event as { type?: string }).type
            const data = (event as { data?: Record<string, any> }).data ?? {}
            const sessionID = typeof data.sessionID === "string" ? data.sessionID : null
            if ((type === "session.execution.succeeded" || type === "session.idle") && sessionID) {
              if (!claim("idle:" + sessionID, 60_000)) continue
              let title = t().readyFallback
              try {
                const s = await ctx.session.get({ sessionID })
                if (s?.title) title = s.title.slice(0, 80)
              } catch {}
              toast(t().readyTitle, title)
            } else if ((type === "session.execution.failed" || type === "session.error") && sessionID) {
              if (!claim("error:" + sessionID, 60_000)) continue
              const msg = data.error?.message ?? data.error
              toast(t().errorTitle, String(msg ?? t().errorFallback).slice(0, 200))
            } else if (type === "permission.asked") {
              const key = typeof data.id === "string" ? data.id : `${Date.now()}`
              if (!claim("perm:" + key, 5 * 60_000)) continue
              toast(t().permissionTitle, t().permissionBody)
            }
          } catch (err) {
            console.error("[win-toast]", err)
          }
        }
      } catch {}
    })()
    return () => controller.abort()
  },
})
