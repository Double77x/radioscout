import { createLazyFileRoute } from "@tanstack/react-router";
import Changelog from "@/pages/Changelog";

export const Route = createLazyFileRoute("/legal/changelog")({
  component: Changelog,
});
