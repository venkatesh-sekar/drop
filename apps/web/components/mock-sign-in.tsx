"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

const STORAGE_KEY = "drop.mock-identity"

const QUICK_PICKS = [
  { name: "Admin User", email: "admin@example.com" },
  { name: "Sam Lee", email: "sam@example.com" },
  { name: "Priya N", email: "priya@example.com" },
]

export function MockSignIn({ next, hasError }: { next: string; hasError: boolean }) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as { name?: string; email?: string }
      // localStorage is only readable after hydration, so it has to land in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(parsed.name ?? "")
      setEmail(parsed.email ?? "")
    } catch {
      // no stored identity, or storage is unavailable
    }
  }, [])

  function remember() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, email }))
    } catch {
      // storage is unavailable; signing in still works
    }
  }

  return (
    <section className="pt-16 sm:pt-24">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        Sign in to Drop (development)
      </h1>
      <p className="mt-4 max-w-[54ch] text-[15px] text-muted-foreground">
        There is no real identity provider here. Whatever email you type becomes your account, and
        the same email always comes back to the same Drops.
      </p>

      <form
        action={`/auth/mock/submit?next=${encodeURIComponent(next)}`}
        method="post"
        onSubmit={remember}
        className="mt-10 max-w-sm"
      >
        <input type="hidden" name="next" value={next} />

        <label htmlFor="mock-name" className="block text-sm font-medium">
          Name
        </label>
        <Input
          id="mock-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada Lovelace"
          autoComplete="off"
          className="mt-2"
        />

        <label htmlFor="mock-email" className="mt-6 block text-sm font-medium">
          Email
        </label>
        <Input
          id="mock-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ada@example.com"
          autoComplete="off"
          className="mt-2"
        />

        {hasError ? (
          <p className="mt-3 text-sm text-destructive">Enter a valid email address.</p>
        ) : null}

        <Button type="submit" className="mt-7">
          Sign in
        </Button>
      </form>

      <div className="mt-10">
        <p className="text-sm text-muted-foreground">Or pick one</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PICKS.map((pick) => (
            <Button
              key={pick.email}
              variant="outline"
              size="sm"
              onClick={() => {
                setName(pick.name)
                setEmail(pick.email)
              }}
            >
              {pick.name}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
