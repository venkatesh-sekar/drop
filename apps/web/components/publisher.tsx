"use client"

import * as React from "react"
import { zip } from "fflate"
import { homePage, wrapperPrefix } from "@drop/core/layout"
import {
  isBuildOutputName,
  isReservedPath,
  isValidPath,
  normalizePath,
  suggestPathFromFile,
} from "@drop/core/paths"
import { EXPIRY_PRESET_DAYS, type Expiry } from "@drop/core/expiry"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"

import { copyText } from "@/components/copy-button"
import {
  CUSTOM_EXPIRY_HINT,
  CustomExpiryDialog,
  ExpiryMenuItems,
  customExpiry,
} from "@/components/expiry-menu"
import { formatBytes, expiryLabel } from "@/lib/time"

/** One of the preset buttons, "custom" for a typed day count, or null to keep a Drop's current expiry. */
type ExpiryChoice = `${(typeof EXPIRY_PRESET_DAYS)[number]}d` | "never" | "custom" | null

const DEFAULT_EXPIRY_CHOICE: ExpiryChoice = "7d"

/** Select value standing in for "keep this Drop's current expiry" (a null choice). */
const KEEP_EXPIRY = "keep"

type ExpirySelectValue = Exclude<ExpiryChoice, null> | typeof KEEP_EXPIRY

function isExpirySelectValue(value: unknown): value is ExpirySelectValue {
  return typeof value === "string" && value in expiryItems
}

const expiryItems: Record<ExpirySelectValue, string> = {
  [KEEP_EXPIRY]: "Keep current expiry",
  "7d": "7 days",
  "30d": "30 days",
  "60d": "60 days",
  custom: "Custom",
  never: "Never",
}

interface PickedFile {
  path: string
  file: File
}

type Selection =
  | {
      kind: "files"
      /** What the user picked: a folder name, a file name, or "3 items". */
      name: string
      files: PickedFile[]
      totalBytes: number
      /** What visitors land on: "index.html", the lone html file, or null when nothing qualifies. */
      home: string | null
      suggestedPath: string
    }
  | { kind: "zip"; name: string; file: File; totalBytes: number; suggestedPath: string }

interface DeployedSite {
  url: string
  path: string
  expires_at: string | null
  status: "active" | "expired"
}

type Availability = "free" | "yours" | "taken"

interface AvailabilityCheck {
  path: string
  availability: Availability
  site: DeployedSite | null
}

const IGNORED = (path: string): boolean => {
  const segments = path.split("/")
  if (segments.some((s) => s === "__MACOSX" || s === ".git" || s === "node_modules")) return true
  const base = segments[segments.length - 1] ?? ""
  return base === ".DS_Store" || base === "Thumbs.db"
}

const isZipName = (name: string): boolean => /\.zip$/i.test(name)
const isHtmlName = (name: string): boolean => /\.html?$/i.test(name)

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

function zipSelection(file: File): Selection {
  return {
    kind: "zip",
    name: file.name,
    file,
    totalBytes: file.size,
    suggestedPath: suggestPathFromFile(file.name),
  }
}

/** A folder, a lone file, or a handful of files, as one selection. */
function filesSelection(files: PickedFile[], name: string, suggestedPath: string): Selection | null {
  const kept = files.filter((f) => !IGNORED(f.path))
  if (kept.length === 0) return null
  const paths = kept.map((f) => f.path)
  const prefix = wrapperPrefix(paths)
  const effective = prefix ? paths.map((p) => p.slice(prefix.length)) : paths
  return {
    kind: "files",
    name,
    files: kept,
    totalBytes: kept.reduce((sum, f) => sum + f.file.size, 0),
    home: homePage(effective),
    suggestedPath,
  }
}

function folderSuggestion(folderName: string): string {
  // "dist" says nothing about the site; leave the name to the user.
  return isBuildOutputName(folderName) ? "" : normalizePath(folderName)
}

/** Turn whatever landed in a drop into a selection. */
async function selectionFromDataTransfer(data: DataTransfer): Promise<Selection | null> {
  const entries = Array.from(data.items ?? [])
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry))

  if (entries.length === 1) {
    const [entry] = entries as [FileSystemEntry]
    const picked = await readEntry(entry, "")
    if (entry.isFile) {
      const file = picked[0]?.file
      if (!file) return null
      if (isZipName(file.name)) return zipSelection(file)
      return filesSelection(
        [{ path: file.name, file }],
        file.name,
        suggestPathFromFile(file.name),
      )
    }
    const inside = picked.map((f) => ({ ...f, path: f.path.slice(entry.name.length + 1) }))
    return filesSelection(inside, entry.name, folderSuggestion(entry.name))
  }

  if (entries.length > 1) {
    const collected: PickedFile[] = []
    for (const entry of entries) collected.push(...(await readEntry(entry, "")))
    return filesSelection(collected, `${entries.length} items`, "")
  }

  // No entries API: plain files only.
  const files = Array.from(data.files ?? [])
  if (files.length === 1) {
    const [file] = files as [File]
    if (isZipName(file.name)) return zipSelection(file)
    return filesSelection([{ path: file.name, file }], file.name, suggestPathFromFile(file.name))
  }
  if (files.length > 1) {
    return filesSelection(
      files.map((file) => ({ path: file.name, file })),
      `${files.length} items`,
      "",
    )
  }
  return null
}

function zipAsync(entries: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files")
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
  // Once the user has typed a name, a new drop must not overwrite it.
  const [pathEdited, setPathEdited] = React.useState(Boolean(initialPath))
  const [expiryChoice, setExpiryChoice] = React.useState<ExpiryChoice>(
    initialPath ? null : DEFAULT_EXPIRY_CHOICE,
  )
  const [customDays, setCustomDays] = React.useState("")
  const [customOpen, setCustomOpen] = React.useState(false)
  const [spa, setSpa] = React.useState(false)
  const [showMore, setShowMore] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [warnings, setWarnings] = React.useState<string[]>([])
  const [result, setResult] = React.useState<DeployedSite | null>(null)
  const [availability, setAvailability] = React.useState<AvailabilityCheck | null>(null)

  const folderInput = React.useRef<HTMLInputElement | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const pathInput = React.useRef<HTMLInputElement>(null)

  // webkitdirectory has no typed React prop; set it on the DOM node each time it mounts
  // (the input is recreated after every publish).
  const attachFolderInput = React.useCallback((node: HTMLInputElement | null) => {
    folderInput.current = node
    if (!node) return
    node.setAttribute("webkitdirectory", "")
    node.setAttribute("directory", "")
  }, [])

  const pathError = pathMessage(path)
  const taken = availability?.path === path && availability.availability === "taken"
  const replacing = availability?.path === path && availability.availability === "yours"
  const hasHomePage = selection?.kind === "zip" || Boolean(selection?.home)
  // null: keep the Drop's current expiry, or a custom count that is not valid yet.
  const expiry: Expiry | null = expiryChoice === "custom" ? customExpiry(customDays) : expiryChoice
  const customInvalid = expiryChoice === "custom" && customDays.trim() !== "" && expiry === null
  const customMissing = expiryChoice === "custom" && expiry === null
  const canPublish =
    Boolean(selection) && hasHomePage && !pathError && !taken && !customMissing && !busy

  /** Take a new selection. `fresh` starts over, as after a finished publish. */
  function choose(next: Selection | null, fresh = false) {
    if (fresh) reset()
    setFailure(null)
    setWarnings([])
    if (!next) {
      setFailure("That drop had no files in it.")
      return
    }
    setSelection(next)
    const suggest = fresh || !pathEdited || path === ""
    if (suggest) setPath(next.suggestedPath)
    if (suggest && !next.suggestedPath) pathInput.current?.focus()
  }

  // Drops land anywhere on the page. Without this the browser would navigate to the file.
  const busyRef = React.useRef(busy)
  const chooseRef = React.useRef(choose)
  const resultRef = React.useRef(result)
  React.useEffect(() => {
    busyRef.current = busy
    chooseRef.current = choose
    resultRef.current = result
  })
  React.useEffect(() => {
    let depth = 0
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      if (!busyRef.current) setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = busyRef.current ? "none" : "copy"
    }
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (busyRef.current || !event.dataTransfer) return
      void selectionFromDataTransfer(event.dataTransfer).then((next) =>
        chooseRef.current(next, Boolean(resultRef.current)),
      )
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragover", over)
    window.addEventListener("dragleave", leave)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragover", over)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("drop", drop)
    }
  }, [])

  // Closing the tab mid-upload loses the Drop; make the browser ask first.
  React.useEffect(() => {
    if (!busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [busy])

  // Ask whether the path is free before the upload, not after.
  React.useEffect(() => {
    if (!signedIn || pathError) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/sites/${encodeURIComponent(path)}/availability`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
        })
        if (!response.ok) return
        const body = (await response.json()) as AvailabilityCheck
        setAvailability({ path, availability: body.availability, site: body.site })
      } catch {
        /* offline or aborted: the server still checks on publish */
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [path, pathError, signedIn])

  function onFolderInput(event: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (all.length === 0) return
    const first = all[0]!.webkitRelativePath
    const folderName = first.includes("/") ? first.slice(0, first.indexOf("/")) : ""
    const files = all.map((file) => ({
      path: folderName ? file.webkitRelativePath.slice(folderName.length + 1) : file.name,
      file,
    }))
    choose(filesSelection(files, folderName || "Folder", folderSuggestion(folderName)))
  }

  function onFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (isZipName(file.name)) choose(zipSelection(file))
    else choose(filesSelection([{ path: file.name, file }], file.name, suggestPathFromFile(file.name)))
  }

  async function publish() {
    if (!signedIn) {
      window.location.href = `/auth/login?next=${encodeURIComponent("/")}`
      return
    }
    if (!selection || !canPublish) return

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

  async function changeExpiry(next: Expiry) {
    if (!result) return
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
    setPathEdited(false)
    setExpiryChoice(DEFAULT_EXPIRY_CHOICE)
    setCustomDays("")
    setCustomOpen(false)
    setSpa(false)
    setShowMore(false)
    setFailure(null)
    setWarnings([])
    setAvailability(null)
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                }
              >
                change
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <ExpiryMenuItems
                  onPick={(next) => void changeExpiry(next)}
                  onCustom={() => setCustomOpen(true)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
          <CustomExpiryDialog
            open={customOpen}
            onOpenChange={setCustomOpen}
            onSubmit={(next) => void changeExpiry(next)}
          />
          <button
            type="button"
            onClick={reset}
            className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Publish another
          </button>
        </div>

        {dragging ? (
          <p className="mt-6 text-sm text-primary">Drop it to publish another.</p>
        ) : null}

        {failure ? <p className="mt-6 text-sm text-destructive">{failure}</p> : null}
      </section>
    )
  }

  return (
    <section className="pt-8 sm:pt-12">
      <input ref={attachFolderInput} type="file" multiple hidden onChange={onFolderInput} />
      <input
        ref={fileInput}
        type="file"
        accept=".html,.htm,.zip,text/html,application/zip"
        hidden
        onChange={onFileInput}
      />

      {selection ? (
        <SummaryRow
          selection={selection}
          progress={progress}
          dragging={dragging}
          onChange={() => {
            setSelection(null)
            setFailure(null)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!signedIn) {
              window.location.href = `/auth/login?next=${encodeURIComponent("/")}`
              return
            }
            folderInput.current?.click()
          }}
          className={[
            "flex h-[45vh] min-h-64 w-full flex-col justify-end rounded-3xl border border-dashed p-7 text-left transition-colors outline-none sm:h-[55vh] sm:p-9",
            dragging ? "border-primary bg-primary/5" : "border-foreground/20 hover:bg-muted/40",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          ].join(" ")}
        >
          <span className="block text-[2.25rem] leading-[1.1] font-medium tracking-tight text-balance sm:text-[3rem]">
            {dragging ? "Drop it." : signedIn ? "Drop a folder. Get a URL." : "Sign in to publish."}
          </span>
          <span className="mt-3 block text-[15px] text-muted-foreground">
            Drag a folder, an HTML file or a .zip anywhere on this page, or click to choose a folder.
          </span>
        </button>
      )}

      {!selection ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Just one page?{" "}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            choose an HTML file or a .zip
          </button>
          . A single HTML file needs no index.html.
        </p>
      ) : null}

      <div className="mt-10">
        <label htmlFor="drop-path" className="sr-only">
          Path
        </label>
        <div className="flex flex-wrap items-baseline gap-x-1 text-xl sm:text-2xl">
          <span className="text-muted-foreground">{sitesHost}/</span>
          <input
            ref={pathInput}
            id="drop-path"
            value={path}
            spellCheck={false}
            autoComplete="off"
            placeholder="route-optimizer"
            onChange={(event) => {
              setPath(event.target.value)
              setPathEdited(true)
            }}
            onBlur={(event) => setPath(normalizePath(event.target.value))}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              setPath(normalizePath(event.currentTarget.value))
              if (canPublish) void publish()
            }}
            className="min-w-0 flex-1 basis-48 rounded-sm bg-transparent py-1 outline-none placeholder:text-muted-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
        {path && pathError ? (
          <p className="mt-2 text-sm text-destructive">{pathError}</p>
        ) : taken ? (
          <p className="mt-2 text-sm text-destructive">
            {path} is taken by someone else. Try another name.
          </p>
        ) : replacing ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {availability?.site?.status === "expired"
              ? "Yours, currently expired. Publishing brings it back at the same URL."
              : "Yours already. Publishing replaces what is there, at the same URL."}
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="drop-expiry" className="sr-only">
            Expiry
          </label>
          <Select
            items={expiryItems}
            value={expiryChoice ?? KEEP_EXPIRY}
            onValueChange={(value) => {
              // The Select only emits values it was given, so the lookup is a type narrowing, not a guess.
              const choice = isExpirySelectValue(value) && value !== KEEP_EXPIRY ? value : null
              setExpiryChoice(choice)
            }}
          >
            <SelectTrigger id="drop-expiry" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {initialPath ? <SelectItem value={KEEP_EXPIRY}>{expiryItems[KEEP_EXPIRY]}</SelectItem> : null}
              {EXPIRY_PRESET_DAYS.map((days) => (
                <SelectItem key={days} value={`${days}d`}>
                  {days} days
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
          {expiryChoice === "custom" ? (
            <span className="flex items-center gap-1.5">
              <label htmlFor="drop-expiry-days" className="sr-only">
                Days until expiry
              </label>
              <Input
                id="drop-expiry-days"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={customDays}
                aria-invalid={customInvalid || undefined}
                onChange={(event) => setCustomDays(event.target.value)}
                className="h-8 w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </span>
          ) : null}
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

      {expiryChoice === null ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Keeping this Drop&rsquo;s current expiry unless you choose one.
        </p>
      ) : customInvalid ? (
        <p className="mt-3 text-[13px] text-destructive">{CUSTOM_EXPIRY_HINT}</p>
      ) : expiryChoice === "custom" ? (
        <p className="mt-3 text-[13px] text-muted-foreground">{CUSTOM_EXPIRY_HINT}</p>
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

function homePageNote(selection: Selection): { text: string; problem: boolean } {
  if (selection.kind === "zip") return { text: "Archive", problem: false }
  if (selection.home === "index.html") return { text: "index.html found", problem: false }
  if (selection.home) return { text: "Published as index.html", problem: false }
  if (selection.files.length === 1 && !isHtmlName(selection.files[0]!.path)) {
    return {
      text: "Only an HTML file can be published on its own. Put it in a folder with an index.html.",
      problem: true,
    }
  }
  return {
    text: "No index.html at the top. Choose your build output (dist, build, out).",
    problem: true,
  }
}

function SummaryRow({
  selection,
  progress,
  dragging,
  onChange,
}: {
  selection: Selection
  progress: number | null
  dragging: boolean
  onChange: () => void
}) {
  const detail =
    selection.kind === "zip"
      ? formatBytes(selection.totalBytes)
      : `${selection.files.length} file${selection.files.length === 1 ? "" : "s"}  ${formatBytes(selection.totalBytes)}`

  const note = homePageNote(selection)

  return (
    <div
      className={[
        "rounded-3xl border p-5 transition-colors sm:p-6",
        dragging ? "border-dashed border-primary bg-primary/5" : "border-border",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-lg font-medium">{selection.name}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
        <button
          type="button"
          onClick={onChange}
          className="ml-auto rounded-sm text-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Change
        </button>
      </div>
      <p className={`mt-2 text-sm ${note.problem ? "text-destructive" : "text-muted-foreground"}`}>
        {dragging ? "Drop it to replace this." : note.text}
      </p>
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
      return "No index.html at the top. Choose your build output (dist, build, out), or a single HTML file."
    case "invalid_archive":
      return "Could not read that archive. Is it a valid .zip?"
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
