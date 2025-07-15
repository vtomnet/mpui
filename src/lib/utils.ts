import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}
