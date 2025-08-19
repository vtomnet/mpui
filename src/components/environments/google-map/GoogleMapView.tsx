import { useEffect, useImperativeHandle, forwardRef, PropsWithChildren } from "react";
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';

export interface MapActions {
  panTo: (lonLat: [number, number]) => void;
}

interface Props {
  initialCenter: [number, number] | null;
  setInitialCenter: (center: [number, number]) => void;
}

// Inner component to get map instance
const InnerMap = forwardRef<MapActions, PropsWithChildren<{
    initialCenter: [number, number],
}>>(({ children, initialCenter }, ref) => {
    const map = useMap();

    useImperativeHandle(ref, () => ({
        panTo(lonLat: [number, number]) {
            if (map) {
                map.panTo({ lng: lonLat[0], lat: lonLat[1] });
                map.setZoom(17);
            }
        },
    }));

    return (
        <div className="relative w-full h-full">
            <Map
                defaultCenter={{ lng: initialCenter[0], lat: initialCenter[1] }}
                defaultZoom={14}
                mapTypeId={'hybrid'}
                className="w-full h-full"
                gestureHandling={'greedy'}
                disableDefaultUI={true}
                renderingType='VECTOR'
            />
            {children}
        </div>
    )
});

InnerMap.displayName = "InnerMap";

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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <p className="text-red-500 p-4 text-center">Google Maps API key is missing.<br/>Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.</p>
        </div>
    );
  }

  if (!initialCenter) {
      return <div className="w-full h-full flex items-center justify-center">Getting location...</div>;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <InnerMap ref={ref} initialCenter={initialCenter}>
        {children}
      </InnerMap>
    </APIProvider>
  );
});
GoogleMapView.displayName = "GoogleMapView";

export default GoogleMapView;
