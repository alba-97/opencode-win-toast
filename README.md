# opencode-win-toast

Windows toast notifications for OpenCode.

## Overview

This plugin shows a native Windows toast when OpenCode needs your attention:

- Task finished (`session.execution.succeeded` / `session.idle`) → session title.
- Execution failed (`session.execution.failed` / `session.error`) → error message.
- Permission requested (`permission.asked`) → approval prompt.

Deduplication: one toast per session/error/permission window (60 s for idle/error, 5 min for permissions) via `state.json`, so parallel sessions don't spam you.

## Languages

Message language is detected from the system locale (`Intl.DateTimeFormat().resolvedOptions().locale`, with `LC_ALL` / `LANG` / `LANGUAGE` as fallback). Falls back to English.

| Lang | Done | Error | Permission |
|------|--------------|-------|----------------------|
| en | Task ready, check the terminal | Something failed | The AI needs your approval |
| es | Tarea lista, revisa el terminal | Algo falló | La IA necesita tu aprobación |
| fr | Tâche terminée, vérifiez le terminal | Quelque chose a échoué | L'IA a besoin de votre approbation |
| de | Aufgabe bereit, Terminal prüfen | Etwas ist fehlgeschlagen | Die KI braucht deine Zustimmung |
| pt | Tarefa pronta, verifique o terminal | Algo falhou | A IA precisa da sua aprovação |
| it | Attività completata, controlla il terminale | Qualcosa è andato storto | L'IA ha bisogno della tua approvazione |

To add a language, extend `STRINGS` in `index.ts` with a new BCP-47 primary subtag (e.g. `nl`, `ja`).

## Requirements

- Windows + PowerShell.
- Windows notifications enabled for toasts to appear (Settings → System → Notifications must be on, and Do Not Disturb off). No OpenCode-side notification setting is required: this plugin calls BurntToast directly and does not depend on OpenCode's own notification configuration.
- [BurntToast](https://github.com/Windos/BurntToast) module (used by `New-BurntToastNotification`):

```powershell
Install-Module -Name BurntToast -Scope CurrentUser
```

## Installation

Install from npm with the OpenCode CLI (this also updates your config):

```sh
opencode plugin opencode-win-toast
```

Use `--global` / `-g` to install it in your global config:

```sh
opencode plugin opencode-win-toast --global
```

Alternatively, register it manually in your OpenCode config (`opencode.json` / `opencode.jsonc`):

```json
{
  "plugin": ["opencode-win-toast"]
}
```

For a local checkout, point at this repository:

```json
{
  "plugin": ["file:///C:/Users/<your-user>/opencode-win-toast"]
}
```

Then restart OpenCode and trigger an event (finish a task, force an error, or make the agent ask for permission) to see the toast.

## How it works

- `index.ts` subscribes to OpenCode events via `Plugin.define({ setup(ctx) })` and `ctx.event.subscribe`.
- `toast()` calls `powershell.exe -NoProfile -WindowStyle Hidden -Command New-BurntToastNotification -Text '<title>','<body>'`.
- `claim(key, windowMs)` in `state.json` guarantees a single notification per key within the window, even with multiple OpenCode processes.
- `state.json` entries older than 5 minutes are pruned on each claim.

## Troubleshooting

- No toast appears → verify BurntToast is installed: `Get-Module -ListAvailable BurntToast`, and check Windows Settings → System → Notifications is on with Do Not Disturb off.
- Toast shows English instead of your language → check your system locale output: `Intl.DateTimeFormat().resolvedOptions().locale` in node.
