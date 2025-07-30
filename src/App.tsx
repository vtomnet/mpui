import { useState, useRef, useEffect } from "react";
import MapView, { MapActions } from "@/components/MapView";
import PathPlan from "@/components/PathPlan";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextOrMicInput from "@/components/TextOrMicInput";

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);
  const [postXml, setPostXml] = useState<boolean>(true);
  const [deviceHost, setDeviceHost] = useState<string>(location.host);
  const [model, setModel] = useState<string>("o4-mini/low");
  const [schemaName, setSchemaName] = useState<string>("gazebo_minimal");
  const [geojsonName, setGeojsonName] = useState<string>("test");
  const [environment, setEnvironment] = useState<string>("none");
  const [taskXml, setTaskXml] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  const mapRef = useRef<MapActions>(null);

  useEffect(() => {
    if (fetchError) {
      const timer = setTimeout(() => {
        setFetchError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchError]);

  // TODO only request location if loading the map
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setInitialCenter([p.coords.longitude, p.coords.latitude]),
      (error) => {
        console.error("Error getting user location:", error);
        setInitialCenter([-120.4202, 37.2664]);
      }
    );
  }, []);

  const handleFinalResult = async (xml: string) => {
    setInterimText(""); // Clear interim text when final result is received
    console.log(xml);
    setTaskXml(xml);
    setFetchError(null);
    if (postXml) {
      try {
        console.log("Fetching to endpoint...");
        const response = await fetch(`https://${deviceHost}/device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: xml }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
      } catch (error) {
        console.error("Error posting XML to backend:", error);
        setFetchError(
          "Error sending command to device. Check host and connection."
        );
      }
    }
  };

  return (
    <div className="relative w-screen h-screen">
      {environment === "map" && (
        <MapView
          ref={mapRef}
          initialCenter={initialCenter}
          realtimeHighlighting={realtimeHighlighting}
          showCachedPolygons={showCachedPolygons}
        >
          <PathPlan xml={taskXml}/>
        </MapView>
      )}

      <SettingsPanel
        realtimeHighlighting={realtimeHighlighting}
        setRealtimeHighlighting={setRealtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
        setShowCachedPolygons={setShowCachedPolygons}
        postXml={postXml}
        setPostXml={setPostXml}
        deviceHost={deviceHost}
        setDeviceHost={setDeviceHost}
        model={model}
        setModel={setModel}
        schemaName={schemaName}
        setSchemaName={setSchemaName}
        geojsonName={geojsonName}
        setGeojsonName={setGeojsonName}
        environment={environment}
        setEnvironment={setEnvironment}
      />

      <div className="fixed bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4 pointer-events-auto">
            {environment === "map" && (
              <SearchPanel onPanTo={coords => mapRef.current?.panTo(coords)}/>
            )}
          </div>
        </div>

        {fetchError && (
          <div className="w-full px-4 pb-2">
            <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-xl shadow-lg">
              <p className="text-lg">{fetchError}</p>
            </div>
          </div>
        )}

        {interimText && (
            <div className="w-full px-4 pb-2">
                <div className="bg-black/50 backdrop-blur-md text-white p-4 rounded-xl shadow-lg">
                    <p className="text-lg"><em>"{interimText}"</em></p>
                </div>
            </div>
        )}

        <TextOrMicInput
            onSttResult={setInterimText}
            onFinalResult={handleFinalResult}
            model={model}
            schemaName={schemaName}
            geojsonName={geojsonName}
            setFetchError={setFetchError}
        />
      </div>
    </div>
  );
}
