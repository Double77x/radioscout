import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button-variants";

type ButtonProps = React.ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>;

const Button = ({ className, variant, size, type = "button", ...props }: ButtonProps) => {
  return <ButtonPrimitive type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
};
Button.displayName = "Button";

export { Button };
