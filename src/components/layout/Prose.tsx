import { cn } from "@/lib/utils";

interface ProseProps {
  children: React.ReactNode;
  className?: string;
}

export const Prose = ({ children, className }: ProseProps) => {
  return <div className={cn("max-w-none space-y-6 leading-relaxed", className)}>{children}</div>;
};

export const ProseH2 = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("mt-8 mb-4 text-2xl font-semibold tracking-tight", className)} {...props}>
    {children}
  </h2>
);

// fallow-ignore-next-line unused-export -- public Prose API for future legal/marketing pages
export const ProseH3 = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("mt-6 mb-3 text-lg font-semibold", className)} {...props}>
    {children}
  </h3>
);

// fallow-ignore-next-line unused-export -- public Prose API for future legal/marketing pages
export const ProseP = ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-muted-foreground leading-relaxed", className)} {...props}>
    {children}
  </p>
);
