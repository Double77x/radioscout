import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  iconClassName?: string;
}

export const ThemeToggle = ({ className, iconClassName }: ThemeToggleProps) => {
  const { toggleTheme } = useThemeToggle();

  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={toggleTheme}
      className={cn("size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground", className)}>
      <Sun className={cn("size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90", iconClassName)} />
      <Moon
        className={cn("absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0", iconClassName)}
      />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
};
