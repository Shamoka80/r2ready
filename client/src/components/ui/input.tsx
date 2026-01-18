import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    const hasJadeOverride = className?.includes('bg-jade-override');
    return (
      <input
        type={type}
        className={cn(
          "input-glass flex h-10 w-full rounded-md px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground font-medium relative z-20",
          className
        )}
        style={{
          ...(hasJadeOverride ? {
            // Only apply green for jade override
            background: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgba(34, 197, 94, 0.3)'
          } : { 
            // Force dark background for all other fields
            background: 'linear-gradient(135deg, rgba(25, 25, 25, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%)',
            backgroundColor: 'rgba(25, 25, 25, 0.95)'
          }),
          ...style
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }