"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { HelpCircleIcon } from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

/**
 * A small "?" that explains the control next to it. Opens on hover for speed and
 * on click or focus for touch and keyboard. Keep the text to a few sentences;
 * anything longer belongs on the How it works page, linked with `more`.
 */
export function Hint({
  label,
  children,
  more,
  className,
}: {
  /** Accessible name, e.g. "About expiry". */
  label: string
  children: React.ReactNode
  /** Anchor on the How it works page, e.g. "expiry". */
  more?: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        aria-label={label}
        className={[
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-open:text-foreground",
          className ?? "",
        ].join(" ")}
      >
        <HugeiconsIcon
          icon={HelpCircleIcon}
          strokeWidth={2}
          className="size-4"
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 gap-2 text-[13px] leading-relaxed"
      >
        <div className="text-foreground">{children}</div>
        {more ? (
          <Link
            href={`/how-it-works#${more}`}
            className="w-fit rounded-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Learn more
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
