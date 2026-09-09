"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Expiry } from "@drop/core/expiry"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { copyText } from "@/components/copy-button"
import {
  CustomExpiryDialog,
  ExpiryMenuItems,
  expiryChangedMessage,
} from "@/components/expiry-menu"

export interface DropRow {
  path: string
  url: string
  status: "active" | "expired"
  permanent: boolean
  updated: string
  expiry: string
}

export function DropsList({ rows }: { rows: DropRow[] }) {
  const router = useRouter()
  const [pending, setPending] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState<DropRow | null>(null)
  const [customFor, setCustomFor] = React.useState<DropRow | null>(null)

  async function setExpiry(row: DropRow, expiry: Expiry) {
    setPending(row.path)
    const response = await fetch(`/api/sites/${encodeURIComponent(row.path)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiry }),
    })
    setPending(null)
    if (!response.ok) {
      toast.error("Could not change the expiry.")
      return
    }
    toast.success(expiryChangedMessage(expiry))
    router.refresh()
  }

  async function remove(row: DropRow) {
    setPending(row.path)
    const response = await fetch(`/api/sites/${encodeURIComponent(row.path)}`, {
      method: "DELETE",
    })
    setPending(null)
    setConfirming(null)
    if (!response.ok) {
      toast.error("Could not delete that Drop.")
      return
    }
    toast.success(`Deleted ${row.path}`)
    router.refresh()
  }

  return (
    <>
      <ul className="mt-8 border-t border-border">
        {rows.map((row) => (
          <li
            key={row.path}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-4"
          >
            <div className={`min-w-0 flex-1 basis-64 ${row.status === "expired" ? "opacity-60" : ""}`}>
              <p className="flex items-center gap-2">
                <span className="truncate font-medium">{row.path}</span>
                {row.status === "expired" ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : row.permanent ? (
                  <Badge variant="outline">Permanent</Badge>
                ) : null}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-muted-foreground">
                <span>{row.updated}</span>
                {row.permanent && row.status !== "expired" ? null : <span>{row.expiry}</span>}
                {row.status === "expired" ? <span>Redeploy to bring it back</span> : null}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={row.url} target="_blank" rel="noreferrer" />}
              >
                Open
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void copyText(row.url)}>
                Copy URL
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${row.path}`}
                      disabled={pending === row.path}
                    />
                  }
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem nativeButton={false} render={<Link href={`/?path=${encodeURIComponent(row.path)}`} />}>
                    Redeploy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Expiry</DropdownMenuLabel>
                    <ExpiryMenuItems
                      onPick={(expiry) => void setExpiry(row, expiry)}
                      onCustom={() => setCustomFor(row)}
                    />
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>

      <CustomExpiryDialog
        open={customFor !== null}
        onOpenChange={(open) => !open && setCustomFor(null)}
        onSubmit={(expiry) => customFor && void setExpiry(customFor, expiry)}
      />

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.path}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the site and frees the path.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null}
              onClick={() => confirming && void remove(confirming)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
