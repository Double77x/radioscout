import type { ReactNode } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  value: string;
  title: ReactNode;
  /** Collapsed summary shown at the right of the trigger. */
  summary?: ReactNode;
  /** Extra classes for the summary, e.g. `capitalize` or `normal-case`. */
  summaryClassName?: string;
  children: ReactNode;
}

/** One settings accordion row: shared trigger, summary slot and content padding. */
export function SettingsSection({ value, title, summary, summaryClassName, children }: SettingsSectionProps) {
  return (
    <AccordionItem value={value} className='border-0'>
      <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>
        {title}
        {summary === undefined ? null : (
          <span className={cn("ml-auto pr-2 text-xs font-medium text-muted-foreground", summaryClassName)}>
            {summary}
          </span>
        )}
      </AccordionTrigger>
      <AccordionContent className='px-2'>{children}</AccordionContent>
    </AccordionItem>
  );
}
