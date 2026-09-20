import { createLazyFileRoute } from "@tanstack/react-router";
import Cookies from "@/pages/Cookies";

export const Route = createLazyFileRoute("/legal/cookies")({
  component: Cookies,
});
