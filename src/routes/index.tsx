import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import HomePage from "@/pages/Home";

const homeSearchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  component: HomePage,
});
