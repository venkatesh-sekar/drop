"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

import { expiryLabel, timeAgo } from "@/lib/time"

interface AdminSite {
  path: string
  url: string
  status: "active" | "expired"
  expires_at: string | null
  updated_at: string
  last_deployed_at: string | null
  owner: { id: string; display_name: string; email: string }
}

export function AdminSearch() {
  const [query, setQuery] = React.useState("")
  const [sites, setSites] = React.useState<AdminSite[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [releasing, setReleasing] = React.useState<AdminSite | null>(null)

  const search = React.useCallback(async (q: string) => {
    setBusy(true)
    const response = await fetch(`/api/admin/sites?q=${encodeURIComponent(q)}`)
    setBusy(false)
    if (!response.ok) {
      toast.error("Search failed.")
      return
    }
    const body = (await response.json()) as { sites: AdminSite[] }
    setSites(body.sites)
  }, [])

  async function expire(site: AdminSite) {
    const response = await fetch(`/api/admin/sites/${encodeURIComponent(site.path)}/expire`, {
      method: "POST",
    })
    if (!response.ok) {
      toast.error("Could not expire that Drop.")
      return
    }
    toast.success(`Expired ${site.path}`)
    void search(query)
  }

  async function release(site: AdminSite) {
    const response = await fetch(`/api/admin/sites/${encodeURIComponent(site.path)}`, {
      method: "DELETE",
    })
    setReleasing(null)
    if (!response.ok) {
      toast.error("Could not release that path.")
      return
    }
    toast.success(`Released ${site.path}`)
    void search(query)
  }

  return (
    <>
      <form
        className="mt-8 flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void search(query)
        }}
      >
        <label htmlFor="admin-q" className="sr-only">
          Search Drops
        </label>
        <Input
          id="admin-q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="path, name or email"
          autoComplete="off"
        />
        <Button type="submit" variant="outline" disabled={busy}>
          Search
        </Button>
      </form>

      {sites === null ? null : sites.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted-foreground">Nothing matches that.</p>
      ) : (
        <ul className="mt-8 border-t border-border">
          {sites.map((site) => (
            <li
              key={site.path}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-4"
            >
              <div className={`min-w-0 flex-1 basis-64 ${site.status === "expired" ? "opacity-60" : ""}`}>
                <p className="truncate font-medium">{site.path}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-muted-foreground">
                  <span>
                    {site.owner.display_name} {site.owner.email}
                  </span>
                  <span>Updated {timeAgo(site.last_deployed_at ?? site.updated_at)}</span>
                  <span>{expiryLabel(site.expires_at, site.status)}</span>
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<a href={site.url} target="_blank" rel="noreferrer" />}
                >
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={site.status === "expired"}
                  onClick={() => void expire(site)}
                >
                  Expire
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReleasing(site)}>
                  Release
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={releasing !== null} onOpenChange={(open) => !open && setReleasing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release {releasing?.path}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {releasing?.owner.display_name}&rsquo;s site and frees the path for
              anyone to claim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => releasing && void release(releasing)}>
              Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
