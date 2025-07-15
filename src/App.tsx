import { useState, useRef, useEffect } from "react";
import PlanPreview, { PlanPreviewActions } from "@/components/PlanPreview";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextOrMicInput from "@/components/TextOrMicInput";

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);

  const [taskXml, setTaskXml] = useState<string>("");
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  const planPreviewRef = useRef<PlanPreviewActions>(null);

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
  };

  return (
    <div className="relative w-screen h-screen">
      <PlanPreview
        ref={planPreviewRef}
        xml={taskXml}
        initialCenter={initialCenter}
        realtimeHighlighting={realtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
      />

      <SettingsPanel
        realtimeHighlighting={realtimeHighlighting}
        setRealtimeHighlighting={setRealtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
        setShowCachedPolygons={setShowCachedPolygons}
      />

      <div className="fixed bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <SearchPanel onPanTo={coords => planPreviewRef.current?.panTo(coords)}/>
          </div>
        </div>

        <TextOrMicInput onResult={handlePath} />
      </div>
    </div>
  );
}
