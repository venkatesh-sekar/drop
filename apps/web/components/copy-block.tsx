"use client"

import { Button } from "@workspace/ui/components/button"

import { copyText } from "@/components/copy-button"

/** A block of commands or config with one copy control, no chrome around it. */
export function CopyBlock({ code, label = "Copy" }: { code: string; label?: string }) {
  return (
    <div className="group/copy relative mt-3">
      <pre className="overflow-x-auto rounded-2xl bg-muted/60 px-4 py-3.5 pr-24 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="xs"
        className="absolute top-2.5 right-2.5"
        onClick={() => void copyText(code, "Copied")}
      >
        {label}
      </Button>
    </div>
  )
}
