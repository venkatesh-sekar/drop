import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

import { getSessionUser, userIsAdmin } from "@/lib/auth"
import { UserMenu } from "@/components/user-menu"

export async function Header() {
  const user = await getSessionUser()

  return (
    <header className="mx-auto flex w-full max-w-[720px] items-center gap-4 px-5 py-5 sm:px-6">
      <Link
        href="/"
        className="rounded-sm text-[15px] font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        Drop
      </Link>

      <nav className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/drops" />}>
          My Drops
        </Button>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/cli" />}>
          CLI
        </Button>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/how-it-works" />}>
          <span className="sm:hidden">Help</span>
          <span className="hidden sm:inline">How it works</span>
        </Button>
        {user ? (
          <UserMenu
            name={user.display_name}
            email={user.email}
            isAdmin={userIsAdmin(user)}
          />
        ) : (
          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/auth/login" />}>
            Sign in
          </Button>
        )}
      </nav>
    </header>
  )
}
