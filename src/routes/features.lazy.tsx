import { createLazyFileRoute } from "@tanstack/react-router";
import Features from "@/pages/Features";

export const Route = createLazyFileRoute("/features")({
  component: Features,
});
