import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import HomePage from "@/pages/Home";

const homeSearchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  /** Shareable station link (`/?station=<uuid>`) — opens the detail sheet. */
  station: z.string().optional(),
  /** Agentic autoplay (`/?play=<uuid|alias|name>`, or `&play=1` with `?station=`). Stripped after resolving. */
  play: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  component: HomePage,
});
