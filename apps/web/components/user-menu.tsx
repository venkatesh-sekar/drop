"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

function initials(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[1]?.[0] ?? "") : "")
  return letters.toUpperCase() || "?"
}

/** Sign-out is a POST, so submit a throwaway form rather than following a link. */
function signOut() {
  const form = document.createElement("form")
  form.method = "post"
  form.action = "/auth/logout"
  document.body.appendChild(form)
  form.submit()
}

export function UserMenu({
  name,
  email,
  isAdmin,
}: {
  name: string
  email: string
  isAdmin: boolean
}) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-1 rounded-full"
            aria-label={`Account: ${name}`}
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem nativeButton={false} render={<Link href="/admin" />}>
            Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
