/** How a booking's place and title read to the customer: one rule for the list, the detail and Home. */

/** "Resort area, Country", or whichever half exists, or "TBC". */
export function bookingDestination(destinationName: string | null | undefined, countryName: string | null | undefined): string {
  return destinationName && countryName ? `${destinationName}, ${countryName}` : countryName || destinationName || 'TBC';
}

/** The booking's own title, else "<place> Getaway" (the wording customers already see). */
export function bookingTitle(title: string | null | undefined, destination: string): string {
  return title || `${destination} Getaway`;
}
