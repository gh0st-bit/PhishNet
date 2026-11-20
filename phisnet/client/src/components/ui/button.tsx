import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'

const iconLabels:Record<string,string>={Trash:'Delete',Trash2:'Delete',Edit:'Edit',Pencil:'Edit',SquarePen:'Edit',Eye:'Preview',EyeOff:'Hide',Copy:'Duplicate',Download:'Download',Upload:'Upload',Search:'Search',X:'Close',Menu:'Open menu',Settings:'Settings',HelpCircle:'Help',CircleHelp:'Help',RefreshCw:'Refresh',ChevronRight:'Next',ChevronLeft:'Previous',Plus:'Add',Bell:'Notifications',Check:'Mark as read',MoreVertical:'More actions',EllipsisVertical:'More actions',MoreHorizontal:'More actions',Ellipsis:'More actions'};
function iconLabel(children:React.ReactNode):string|undefined {
  const nodes=React.Children.toArray(children);
  const hasText=(node:React.ReactNode):boolean=>typeof node==='string'?!!node.trim():typeof node==='number'||React.isValidElement<{children?:React.ReactNode}>(node)&&React.Children.toArray(node.props.children).some(hasText);
  if(nodes.some(hasText))return;
  for(const node of nodes)if(React.isValidElement(node)){
    const type=node.type as {displayName?:string};
    const label=iconLabels[type.displayName||''];if(label)return label;
  }
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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
  help?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, help, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const inferred=iconLabel(props.children);
    const label=help||props['aria-label']||props.title||inferred;
    const button=(
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        aria-label={props['aria-label']||props.title||inferred}
      />
    )
    if(!asChild&&label&&(help||inferred)&&!props['aria-haspopup'])return <Tooltip delayDuration={500}><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
    return button;
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
