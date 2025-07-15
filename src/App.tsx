import { useState, useRef, useEffect } from "react";
import MapView, { MapActions } from "@/components/MapView";
import PathPlan from "@/components/PathPlan";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextOrMicInput from "@/components/TextOrMicInput";

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);
  const [taskXml, setTaskXml] = useState<string>("");
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  const mapRef = useRef<MapActions>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setInitialCenter([p.coords.longitude, p.coords.latitude]),
      (error) => {
        console.error("Error getting user location:", error);
        // Fallback to a default location if geolocation fails
        setInitialCenter([-120.4202, 37.2664]);
      }
    );
  }, []);

  const handlePath = async (xml: string) => {
    console.log(xml);
    setTaskXml(xml);
    try {
      await fetch("http://10.106.96.102:12347", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
        },
        body: xml,
      });
    } catch (error) {
      console.error("Error posting XML to backend:", error);
    }
  };

  return (
    <div className="relative w-screen h-screen">
      <MapView
        ref={mapRef}
        initialCenter={initialCenter}
        realtimeHighlighting={realtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
      >
        <PathPlan xml={taskXml}/>
      </MapView>

      <SettingsPanel
        realtimeHighlighting={realtimeHighlighting}
        setRealtimeHighlighting={setRealtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
        setShowCachedPolygons={setShowCachedPolygons}
      />

      <div className="fixed bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <SearchPanel onPanTo={coords => mapRef.current?.panTo(coords)}/>
          </div>
        </div>

        <TextOrMicInput onResult={handlePath} />
      </div>
    </div>
  );
}
