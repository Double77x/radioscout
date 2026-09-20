import { createLazyFileRoute } from "@tanstack/react-router";
import Security from "@/pages/Security";

export const Route = createLazyFileRoute("/legal/security")({
  component: Security,
});
