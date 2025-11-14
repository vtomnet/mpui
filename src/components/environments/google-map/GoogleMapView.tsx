import { useEffect, useImperativeHandle, forwardRef, PropsWithChildren } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import type { MapActions } from "../map/MapView";

interface Props {
  initialCenter: [number, number] | null;
  setInitialCenter: (center: [number, number]) => void;
}

const MapController = forwardRef<MapActions, PropsWithChildren>(({
  children,
}, ref) => {
  const map = useMap();

  useImperativeHandle(ref, () => ({
    panTo(lonLat: [number, number]) {
      if (!map) return;
      map.panTo({ lng: lonLat[0], lat: lonLat[1] });
      map.setZoom(17);
    },
  }), [map]);

  return <>{children}</>;
});
MapController.displayName = "MapController";

const GoogleMapView = forwardRef<MapActions, PropsWithChildren<Props>>(({
  children,
  initialCenter,
  setInitialCenter,
}, ref) => {
  useEffect(() => {
    if (initialCenter) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setInitialCenter([p.coords.longitude, p.coords.latitude]),
      (error) => {
        console.error("Error getting user location:", error);
        setInitialCenter([-120.4202, 37.2664]);
      },
    );
  }, [setInitialCenter, initialCenter]);

  if (!initialCenter) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        Getting location...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={{ lng: initialCenter[0], lat: initialCenter[1] }}
        defaultZoom={14}
        mapTypeId="hybrid"
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI
        renderingType="VECTOR"
      >
        <MapController ref={ref}>{children}</MapController>
      </Map>
    </div>
  );
});
GoogleMapView.displayName = "GoogleMapView";

export default GoogleMapView;
