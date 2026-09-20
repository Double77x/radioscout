import { cn } from "@/lib/utils";

interface CenteredStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
  iconWrapperClassName?: string;
  titleClassName?: string;
  kicker?: React.ReactNode;
}

/**
 * Centralized centered state shell for empty / error / 404 screens.
 * Replaces duplicated `min-h-screen flex items-center justify-center` + icon circle + heading patterns
 * across GlobalErrorComponent, NotFoundComponent, GraphCanvas empty, SvgCanvas empty.
 */
export const CenteredState = ({
  icon,
  title,
  description,
  actions,
  className,
  iconWrapperClassName,
  titleClassName,
  kicker,
}: CenteredStateProps) => {
  return (
    <div className={cn("mx-auto w-full max-w-md animate-fade-in space-y-6 text-center", className)}>
      {kicker}
      {icon && (
        <div
          className={cn(
            "mx-auto flex size-20 items-center justify-center rounded-full border shadow-inner",
            iconWrapperClassName,
          )}>
          {icon}
        </div>
      )}

      <div className='space-y-2'>
        <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground", titleClassName)}>{title}</h1>
        <p className='leading-relaxed text-muted-foreground'>{description}</p>
      </div>

      {actions && <div className='flex flex-col items-center gap-3 pt-4 sm:flex-row'>{actions}</div>}
    </div>
  );
};

interface PageShellProps {
  children: React.ReactNode;
  withChrome?: boolean;
  className?: string;
}

export const FullPageShell = ({ children, className }: PageShellProps) => (
  <div className={cn("flex min-h-screen items-center justify-center bg-background p-6", className)}>{children}</div>
);
