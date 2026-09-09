"use client"

import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"

export async function copyText(value: string, message = "Copied"): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  } catch {
    toast.error("Could not copy. Select the text and copy it by hand.")
  }
}

export function CopyButton({
  value,
  label = "Copy URL",
  message = "Copied",
  variant = "outline",
  size = "default",
  className,
}: {
  value: string
  label?: string
  message?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => void copyText(value, message)}
    >
      {label}
    </Button>
  )
}
