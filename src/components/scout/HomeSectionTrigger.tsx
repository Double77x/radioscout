import type { ReactNode } from "react";
import { AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface HomeSectionTriggerProps {
  icon: ReactNode;
  /** Tailwind tone classes for the square icon tile. */
  tone: string;
  title: string;
  badge?: ReactNode;
  detail?: ReactNode;
}

/** Accordion trigger shared by the Saved, Most loved, Recent and Listening sections. */
export function HomeSectionTrigger({ icon, tone, title, badge, detail }: HomeSectionTriggerProps) {
  return (
    <AccordionTrigger className='py-4 hover:no-underline'>
      <span className='flex items-center gap-3'>
        <span aria-hidden='true' className={cn("grid size-10 place-items-center rounded-2xl", tone)}>
          {icon}
        </span>
        <span className='text-lg font-semibold tracking-tight'>{title}</span>
        {badge}
        {detail}
      </span>
    </AccordionTrigger>
  );
}
