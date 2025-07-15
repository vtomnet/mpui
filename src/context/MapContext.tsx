import { createContext, useContext } from "react";
import { Map as LibreMap } from "maplibre-gl";

export interface MapContextType {
  map: LibreMap | null;
  isMapReady: boolean;
}

export const MapContext = createContext<MapContextType | null>(null);

/**
 * Custom hook to access the map instance and its ready state.
 * Throws an error if used outside of a Map component.
 */
export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a Map component, which provides the MapContext');
  }
  return context;
};
