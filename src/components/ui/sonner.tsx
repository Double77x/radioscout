import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { useIsClient } from "@/hooks/use-is-client";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const isClient = useIsClient();

  return (
    <Sonner
      // Theme state initializes from localStorage during hydration while the
      // prerender used the default — pin to the default until mounted so the
      // toaster shell hydrates identical for stored-theme users.
      theme={isClient ? (theme as ToasterProps["theme"]) : "system"}
      className='toaster group'
      toastOptions={{
        classNames: {
          toast: "group toast !bg-background !text-foreground !border-border !shadow-lg border",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
