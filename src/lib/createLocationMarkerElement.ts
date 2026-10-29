import type { ResolvedLocation } from "./location-geocoding";

/** Builds a safe DOM marker for Globe's htmlElementsData layer. */
export function createLocationMarkerElement(location: Pick<ResolvedLocation, "name">): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "chash-orbit-location-marker";
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `Searched location: ${location.name}`);

  const pulse = document.createElement("span");
  pulse.className = "chash-orbit-location-marker__pulse";
  pulse.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "chash-orbit-location-marker__label";
  // Geocoder output is external data; never interpolate it into innerHTML.
  label.textContent = location.name;

  root.append(pulse, label);
  return root;
}
