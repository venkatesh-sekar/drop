"use client"

import * as React from "react"
import {
  EXPIRY_PRESET_DAYS,
  MAX_EXPIRY_DAYS,
  expiryDays,
  parseExpiry,
  type Expiry,
} from "@drop/core/expiry"
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
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"

/** "7d" for what the user typed, or null when it is not a whole number of days in range. */
export function customExpiry(days: string): Expiry | null {
  return parseExpiry(`${days.trim()}d`)
}

export const CUSTOM_EXPIRY_HINT = `A whole number of days, 1 to ${MAX_EXPIRY_DAYS}.`

/** Toast or status text after an expiry change. */
export function expiryChangedMessage(expiry: Expiry): string {
  const days = expiryDays(expiry)
  if (days === null) return "Now permanent"
  return `Expires in ${days} day${days === 1 ? "" : "s"}`
}

/** The expiry choices for an existing Drop: presets, a custom count, or never. */
export function ExpiryMenuItems({
  onPick,
  onCustom,
}: {
  onPick: (expiry: Expiry) => void
  onCustom: () => void
}) {
  return (
    <>
      {EXPIRY_PRESET_DAYS.map((days) => (
        <DropdownMenuItem key={days} onClick={() => onPick(`${days}d`)}>
          {days} days
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={onCustom}>Custom…</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onPick("never")}>Never</DropdownMenuItem>
    </>
  )
}

/** Asks for a day count and hands back a validated expiry. */
export function CustomExpiryDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (expiry: Expiry) => void
}) {
  const [days, setDays] = React.useState("")
  const expiry = customExpiry(days)
  const invalid = days.trim() !== "" && expiry === null

  function close(next: boolean) {
    if (!next) setDays("")
    onOpenChange(next)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!expiry) return
    onSubmit(expiry)
    close(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <form onSubmit={submit}>
          <AlertDialogHeader>
            <AlertDialogTitle>Expire in how many days?</AlertDialogTitle>
            <AlertDialogDescription>{CUSTOM_EXPIRY_HINT}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 flex items-center gap-2">
            <label htmlFor="custom-expiry-days" className="sr-only">
              Days
            </label>
            <Input
              id="custom-expiry-days"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={days}
              aria-invalid={invalid || undefined}
              onChange={(event) => setDays(event.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={!expiry}>
              Set expiry
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
