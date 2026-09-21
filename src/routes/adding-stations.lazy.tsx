import { createLazyFileRoute } from "@tanstack/react-router";
import AddingStations from "@/pages/AddingStations";

export const Route = createLazyFileRoute("/adding-stations")({
  component: AddingStations,
});
