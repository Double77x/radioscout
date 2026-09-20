import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = ({
  className,
  children,
  align = "center",
  side,
  anchor,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: "start" | "center" | "end";
  side?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  anchor?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["anchor"];
}) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner sideOffset={8} align={align} side={side} anchor={anchor} className='z-400'>
      <PopoverPrimitive.Popup
        className={cn(
          "w-80 overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/10 outline-none",
          className,
        )}
        {...props}>
        {children}
      </PopoverPrimitive.Popup>
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);
PopoverContent.displayName = "PopoverContent";

const PopoverTitle = ({ className, ...props }: React.ComponentProps<typeof PopoverPrimitive.Title>) => (
  <PopoverPrimitive.Title className={cn("text-base font-semibold tracking-tight", className)} {...props} />
);
PopoverTitle.displayName = "PopoverTitle";

const PopoverDescription = ({ className, ...props }: React.ComponentProps<typeof PopoverPrimitive.Description>) => (
  <PopoverPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
);
PopoverDescription.displayName = "PopoverDescription";

export { Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription };
