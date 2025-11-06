import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-glass font-display font-semibold uppercase tracking-wide text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "btn-primary-glass text-primary",
        destructive: "btn-glass bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-pink-500/30 hover:border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
        outline: "btn-glass border-glass-border text-foreground hover:bg-glass-light hover:text-white",
        secondary: "btn-secondary-glass text-secondary",
        ghost: "glass-morphism bg-transparent border-transparent text-foreground hover:bg-glass-light hover:text-white",
        link: "text-primary underline-offset-4 hover:underline bg-transparent hover:bg-transparent text-glow-blue",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-glass px-4 text-xs",
        lg: "h-14 rounded-glass px-8 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }