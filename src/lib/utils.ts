import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface GooglePlace {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
}
