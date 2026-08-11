import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-base leading-[1.45] text-ink transition-[border-color,box-shadow] outline-none placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[13.5px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
