import { createLazyFileRoute } from "@tanstack/react-router";
import Terms from "@/pages/Terms";

export const Route = createLazyFileRoute("/legal/terms")({
  component: Terms,
});
