# HMC admin assistant — free local AI

Sign in as admin and click the sparkle/chat assistant icon beside the notification bell. The panel provides AI chat, medicine lookup and patient lookup. Medicine/patient lookup reads the existing Supabase collections; no schema changes, paid provider or AI connection is needed for those searches.

AI chat uses **Ollama on the computer running the browser**, at `http://localhost:11434`. There is no API usage fee for a local model. Initial installation/model downloads require internet, disk space and enough RAM; response speed depends on the computer. This integration does not install Ollama or download a model automatically.

## Windows setup

1. Install [Ollama for Windows](https://ollama.com/download/windows).
2. In PowerShell, download a small local chat model (the assistant selects it by default):

   ```powershell
   ollama pull gemma3:1b
   ```

3. Open **Setup** inside the HMC assistant. Copy and run its two PowerShell commands. They set `OLLAMA_ORIGINS` to the exact current application origin and `OLLAMA_NO_CLOUD` to `1`. The origin includes protocol, host and port, without a path. Include all trusted HMC origins as a comma-separated list if the computer uses several addresses. Avoid a wildcard origin.
4. Quit Ollama from the system tray and restart it from the Start menu so it picks up the environment changes. If using `ollama serve` manually instead of the tray application, start it in a new terminal after setting the variables; do not run two servers on the same port.
5. Click **Connect / retry**, then select an installed local model. Permit local-network access if the browser prompts. A failed connection is shown explicitly; the app never substitutes fabricated AI replies.

Keep Ollama bound to loopback; there is no need to expose its API on the LAN. If HMC runs on a different computer, install Ollama on the computer running the browser. A browser or organization policy that blocks HTTP loopback/local-network access must allow it for the trusted HMC origin. The assistant does not fall back to an external proxy or provider. See [Ollama configuration and browser origins](https://docs.ollama.com/faq) and [Windows installation](https://docs.ollama.com/windows).

## Behavior and limits

- The assistant icon is admin-only. Generic AI chat uses only the anonymized question and recent conversation with the local model, so a hosted Supabase session is not required for chat. Medicine and patient lookup still require an authenticated admin session; Supabase's existing row policies govern record access.
- Chat calls `/api/tags` and `/api/chat` on loopback, with credentials omitted. Cloud-tagged/remote model options are excluded. Disable cloud in Ollama as described above to ensure local-only execution.
- Patient search matches the actual stored MR number exactly, or names case-insensitively, across operation, OPD and inpatient collections. The search results can open existing record previews. Medicine search includes active main and OT medicines, with generic/strength information where the current catalogue stores it.
- Hospital records are **never attached to the AI prompt**. Only the question and recent conversation are sent to the local model. Chat and search results stay in component memory and clear when the panel closes; they are not written to local storage or the database. Use anonymized questions.
- Chat supports stop, retry, model selection and confirmed conversation clearing. Requests have bounded context/output and timeouts. Closing the panel cancels pending AI requests. Model changes start a new conversation.
- AI output is rendered as escaped text. It has no database write, prescribing or tool execution capability. Clinical output is general reference for qualified doctor review, not a patient-specific diagnosis or prescription. It has no live web search and may be inaccurate/outdated. Links to MedlinePlus and NICE are independent reference links, not sources automatically consulted or citations for generated answers.

API references: [chat](https://docs.ollama.com/api/chat), [installed models](https://docs.ollama.com/api/tags).
