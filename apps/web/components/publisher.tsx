"use client"

import * as React from "react"
import { zip } from "fflate"
import { isReservedPath, isValidPath, normalizePath } from "@drop/core/paths"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"

import { copyText } from "@/components/copy-button"
import { formatBytes, expiryLabel } from "@/lib/time"

type Expiry = "30d" | "never"

interface PickedFile {
  path: string
  file: File
}

type Selection =
  | { kind: "folder"; name: string; files: PickedFile[]; totalBytes: number; hasIndex: boolean }
  | { kind: "zip"; name: string; file: File; totalBytes: number }

interface DeployedSite {
  url: string
  path: string
  expires_at: string | null
  status: "active" | "expired"
}

const IGNORED = (path: string): boolean => {
  const segments = path.split("/")
  if (segments.some((s) => s === "__MACOSX" || s === ".git")) return true
  const base = segments[segments.length - 1] ?? ""
  return base === ".DS_Store" || base === "Thumbs.db"
}

/** Mirror of core's single-wrapper-folder rule, for the client-side index check only. */
function stripSingleRoot(paths: string[]): string[] {
  if (paths.length === 0) return paths
  const tops = new Set(paths.map((p) => p.split("/")[0] ?? ""))
  if (tops.size !== 1) return paths
  const top = [...tops][0]!
  if (!paths.every((p) => p.includes("/"))) return paths
  if (paths.includes("index.html")) return paths
  return paths.map((p) => p.slice(top.length + 1))
}

function pathMessage(path: string): string | null {
  if (path === "") return "Give it a name."
  if (!isValidPath(path)) return "Only letters, numbers and hyphens."
  if (isReservedPath(path)) return `"${path}" is reserved. Pick another name.`
  return null
}

async function readDirectory(entry: FileSystemDirectoryEntry, prefix: string): Promise<PickedFile[]> {
  const reader = entry.createReader()
  const out: PickedFile[] = []
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) break
    for (const child of batch) out.push(...(await readEntry(child, prefix)))
  }
  return out
}

async function readEntry(entry: FileSystemEntry, prefix: string): Promise<PickedFile[]> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name
  if (IGNORED(path)) return []
  if (entry.isDirectory) return readDirectory(entry as FileSystemDirectoryEntry, path)
  const file = await new Promise<File>((resolve, reject) =>
    (entry as FileSystemFileEntry).file(resolve, reject),
  )
  return [{ path, file }]
}

function selectionFromFiles(files: PickedFile[], fallbackName: string): Selection | null {
  const kept = files.filter((f) => !IGNORED(f.path))
  if (kept.length === 0) return null
  const totalBytes = kept.reduce((sum, f) => sum + f.file.size, 0)
  const effective = stripSingleRoot(kept.map((f) => f.path))
  const name = kept[0]!.path.includes("/") ? kept[0]!.path.split("/")[0]! : fallbackName
  return {
    kind: "folder",
    name,
    files: kept,
    totalBytes,
    hasIndex: effective.includes("index.html"),
  }
}

function zipAsync(entries: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

export function Publisher({
  sitesHost,
  signedIn,
  initialPath,
}: {
  sitesHost: string
  signedIn: boolean
  initialPath: string
}) {
  const [selection, setSelection] = React.useState<Selection | null>(null)
  const [path, setPath] = React.useState(initialPath)
  const [expiry, setExpiry] = React.useState<Expiry | null>(initialPath ? null : "30d")
  const [spa, setSpa] = React.useState(false)
  const [showMore, setShowMore] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [warnings, setWarnings] = React.useState<string[]>([])
  const [result, setResult] = React.useState<DeployedSite | null>(null)

  const folderInput = React.useRef<HTMLInputElement>(null)
  const zipInput = React.useRef<HTMLInputElement>(null)

  // webkitdirectory has no typed React prop; set it on the DOM node instead.
  React.useEffect(() => {
    const node = folderInput.current
    if (!node) return
    node.setAttribute("webkitdirectory", "")
    node.setAttribute("directory", "")
  }, [])

  const pathError = pathMessage(path)
  const canPublish = Boolean(selection) && !pathError && !busy

  function choose(next: Selection | null, suggestedName?: string) {
    setFailure(null)
    setWarnings([])
    if (!next) {
      setFailure("That drop had no files in it.")
      return
    }
    setSelection(next)
    if (!path) {
      const source = suggestedName ?? next.name
      setPath(normalizePath(source.replace(/\.zip$/i, "")))
    }
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    const items = Array.from(event.dataTransfer.items ?? [])
    const entries = items
      .map((item) => (item.kind === "file" ? item.webkitGetAsEntry() : null))
      .filter((entry): entry is FileSystemEntry => Boolean(entry))

    if (entries.length === 1 && entries[0]!.isFile && entries[0]!.name.toLowerCase().endsWith(".zip")) {
      const [picked] = await readEntry(entries[0]!, "")
      if (picked) {
        choose({
          kind: "zip",
          name: picked.file.name,
          file: picked.file,
          totalBytes: picked.file.size,
        })
      }
      return
    }

    if (entries.length > 0) {
      const collected: PickedFile[] = []
      for (const entry of entries) collected.push(...(await readEntry(entry, "")))
      choose(selectionFromFiles(collected, entries[0]!.name), entries[0]!.name)
      return
    }

    const files = Array.from(event.dataTransfer.files ?? [])
    const zipFile = files.find((f) => f.name.toLowerCase().endsWith(".zip"))
    if (zipFile) {
      choose({ kind: "zip", name: zipFile.name, file: zipFile, totalBytes: zipFile.size })
      return
    }
    setFailure("Drop a folder or a .zip file.")
  }

  function onFolderInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }))
    choose(selectionFromFiles(files, "site"))
    event.target.value = ""
  }

  function onZipInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) choose({ kind: "zip", name: file.name, file, totalBytes: file.size })
    event.target.value = ""
  }

  async function publish() {
    if (!signedIn) {
      window.location.href = `/auth/login?next=${encodeURIComponent("/")}`
      return
    }
    if (!selection || pathError) return

    if (selection.kind === "folder" && !selection.hasIndex) {
      setFailure("No index.html at the top of this folder. Choose your build output (dist, build, out).")
      return
    }

    setBusy(true)
    setFailure(null)
    setWarnings([])
    setProgress(0)

    try {
      let archive: Blob
      if (selection.kind === "zip") {
        archive = selection.file
      } else {
        const entries: Record<string, Uint8Array> = {}
        for (const item of selection.files) {
          entries[item.path] = new Uint8Array(await item.file.arrayBuffer())
        }
        archive = new Blob([(await zipAsync(entries)) as BlobPart], { type: "application/zip" })
      }

      const form = new FormData()
      form.append("archive", archive, "site.zip")
      if (expiry) form.append("expiry", expiry)
      if (spa) form.append("spa", "true")

      const response = await upload(`/api/sites/${encodeURIComponent(path)}/deploy`, form, setProgress)
      if (response.ok) {
        const body = response.body as {
          url: string
          path: string
          site: DeployedSite
          warnings?: string[]
        }
        setResult({
          url: body.url,
          path: body.path,
          expires_at: body.site.expires_at,
          status: body.site.status,
        })
        setWarnings(body.warnings ?? [])
      } else {
        setFailure(publishError(response.body, path))
      }
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The upload failed. Try again.")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function changeExpiry() {
    if (!result) return
    const next: Expiry = result.expires_at === null ? "30d" : "never"
    const response = await fetch(`/api/sites/${encodeURIComponent(result.path)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiry: next }),
    })
    if (!response.ok) {
      setFailure("Could not change the expiry. Try again from My Drops.")
      return
    }
    const body = (await response.json()) as { site: DeployedSite }
    setResult({ ...result, expires_at: body.site.expires_at, status: body.site.status })
  }

  function reset() {
    setSelection(null)
    setResult(null)
    setPath("")
    setExpiry("30d")
    setSpa(false)
    setShowMore(false)
    setFailure(null)
    setWarnings([])
  }

  if (result) {
    return (
      <section className="pt-10 sm:pt-16">
        <h1 className="text-[2.5rem] leading-[1.1] font-medium tracking-tight text-balance sm:text-[3rem]">
          Your Drop is live.
        </h1>

        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          className="mt-8 block text-xl break-all decoration-primary underline-offset-4 outline-none hover:underline focus-visible:underline sm:text-2xl"
        >
          <span className="text-muted-foreground">{sitesHost}/</span>
          <span>{result.path}/</span>
        </a>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button nativeButton={false} render={<a href={result.url} target="_blank" rel="noreferrer" />}>
            Open
          </Button>
          <Button variant="outline" onClick={() => void copyText(result.url)}>
            Copy URL
          </Button>
        </div>

        {warnings.length > 0 ? (
          <ul className="mt-7 space-y-1 text-[13px] text-muted-foreground">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            {expiryLabel(result.expires_at, result.status)}
            <button
              type="button"
              onClick={() => void changeExpiry()}
              className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              change
            </button>
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Publish another
          </button>
        </div>

        {failure ? <p className="mt-6 text-sm text-destructive">{failure}</p> : null}
      </section>
    )
  }

  return (
    <section className="pt-8 sm:pt-12">
      <input ref={folderInput} type="file" multiple hidden onChange={onFolderInput} />
      <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={onZipInput} />

      {selection ? (
        <SummaryRow
          selection={selection}
          progress={progress}
          onChange={() => {
            setSelection(null)
            setFailure(null)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => folderInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void onDrop(event)}
          className={[
            "flex h-[45vh] min-h-64 w-full flex-col justify-end rounded-3xl border border-dashed p-7 text-left transition-colors outline-none sm:h-[55vh] sm:p-9",
            dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          ].join(" ")}
        >
          <span className="block text-[2.25rem] leading-[1.1] font-medium tracking-tight text-balance sm:text-[3rem]">
            {signedIn ? "Drop a folder. Get a URL." : "Sign in to publish."}
          </span>
          <span className="mt-3 block text-[15px] text-muted-foreground">
            Drag a folder or a .zip here, or choose a folder.
          </span>
        </button>
      )}

      {!selection ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Got an archive already?{" "}
          <button
            type="button"
            onClick={() => zipInput.current?.click()}
            className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            choose a .zip
          </button>
        </p>
      ) : null}

      <div className="mt-10">
        <label htmlFor="drop-path" className="sr-only">
          Path
        </label>
        <div className="flex flex-wrap items-baseline gap-x-1 text-xl sm:text-2xl">
          <span className="text-muted-foreground">{sitesHost}/</span>
          <input
            id="drop-path"
            value={path}
            spellCheck={false}
            autoComplete="off"
            placeholder="route-optimizer"
            onChange={(event) => setPath(event.target.value)}
            onBlur={(event) => setPath(normalizePath(event.target.value))}
            className="min-w-0 flex-1 basis-48 rounded-sm bg-transparent py-1 outline-none placeholder:text-muted-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
        {path && pathError ? (
          <p className="mt-2 text-sm text-destructive">{pathError}</p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1" role="group" aria-label="Expiry">
          <Button
            variant={expiry === "30d" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={expiry === "30d"}
            onClick={() => setExpiry("30d")}
          >
            Expires in 30 days
          </Button>
          <Button
            variant={expiry === "never" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={expiry === "never"}
            onClick={() => setExpiry("never")}
          >
            Never
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showMore}
          onClick={() => setShowMore((value) => !value)}
        >
          More
        </Button>

        <div className="ml-auto">
          <Button disabled={!canPublish && signedIn} onClick={() => void publish()}>
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {expiry === null ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Keeping this Drop&rsquo;s current expiry unless you choose one.
        </p>
      ) : null}

      {showMore ? (
        <div className="mt-6 flex items-start gap-3">
          <Switch id="drop-spa" checked={spa} onCheckedChange={setSpa} />
          <div>
            <label htmlFor="drop-spa" className="text-sm font-medium">
              Single-page app
            </label>
            <p className="text-[13px] text-muted-foreground">
              Serve index.html for unknown routes, so deep links into a client-side router work.
            </p>
          </div>
        </div>
      ) : null}

      {failure ? <p className="mt-6 text-sm text-destructive">{failure}</p> : null}
    </section>
  )
}

function SummaryRow({
  selection,
  progress,
  onChange,
}: {
  selection: Selection
  progress: number | null
  onChange: () => void
}) {
  const detail =
    selection.kind === "zip"
      ? formatBytes(selection.totalBytes)
      : `${selection.files.length} file${selection.files.length === 1 ? "" : "s"}  ${formatBytes(selection.totalBytes)}`

  const note =
    selection.kind === "zip"
      ? "Archive"
      : selection.hasIndex
        ? "index.html found"
        : "No index.html at the top"

  return (
    <div className="rounded-3xl border border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-lg font-medium">{selection.name}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
        <span
          className={
            selection.kind === "folder" && !selection.hasIndex
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {note}
        </span>
        <button
          type="button"
          onClick={onChange}
          className="ml-auto rounded-sm text-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Change
        </button>
      </div>
      {progress !== null ? (
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

interface UploadResult {
  ok: boolean
  body: unknown
}

/** XHR, not fetch: it is the only way to report upload progress. */
function upload(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("POST", url)
    request.setRequestHeader("accept", "application/json")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onerror = () => reject(new Error("The upload failed. Check your connection and try again."))
    request.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(request.responseText)
      } catch {
        body = null
      }
      resolve({ ok: request.status >= 200 && request.status < 300, body })
    }
    request.send(form)
  })
}

function publishError(body: unknown, path: string): string {
  const parsed = body as { error?: string; message?: string } | null
  switch (parsed?.error) {
    case "path_taken":
      return `${path} is taken by someone else. Try another name.`
    case "invalid_path":
      return "Only letters, numbers and hyphens."
    case "reserved_path":
      return `"${path}" is reserved. Pick another name.`
    case "missing_index":
      return "No index.html at the top of this folder. Choose your build output (dist, build, out)."
    case "site_too_large":
    case "archive_too_large":
      return "That's over the 200 MB limit."
    case "too_many_files":
      return "That folder has too many files. Trim it and try again."
    case "file_too_large":
      return "One of those files is over the 25 MB limit."
    case "unauthenticated":
      return "Your session expired. Sign in and try again."
    default:
      return parsed?.message ?? "Publishing failed. Try again."
  }
}
