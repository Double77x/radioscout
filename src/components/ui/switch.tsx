import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

const Switch = ({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) => (
  <SwitchPrimitive.Root
    className={cn(
      "flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-muted px-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-checked:bg-scout-ink disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}>
    <SwitchPrimitive.Thumb className='block size-4 rounded-full bg-scout-paper shadow transition-transform data-checked:translate-x-4' />
  </SwitchPrimitive.Root>
);
Switch.displayName = "Switch";

export { Switch };
