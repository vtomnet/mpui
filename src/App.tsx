import { useState, useRef, useEffect, useCallback } from "react";
import type { URDFRobot } from "urdf-loader";
import MapView, { MapActions } from "@/components/environments/map/MapView";
import GoogleMapView from "@/components/environments/google-map/GoogleMapView";
import KinovaKortexGen3View from "@/components/environments/kinova-kortex-gen3-6dof/KinovaKortexGen3View";
import PathPlan from "@/components/PathPlan";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextOrMicInput from "@/components/TextOrMicInput";
import EnvironmentDropdown from "@/components/EnvironmentDropdown";
import { environments } from "@/lib/environments";

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);
  const [postXml, setPostXml] = useState<boolean>(false);
  const [deviceHost, setDeviceHost] = useState<string>(location.host);
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  const [schemaName, setSchemaName] = useState<string>("kinova_gen3_6dof");
  const [geojsonName, setGeojsonName] = useState<string>("None");
  const [environment, setEnvironment] = useState<string>("Kinova Kortex Gen3 6DOF");
  const [taskXml, setTaskXml] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [sessionName, setSessionName] = useState<string>("");

  const mapRef = useRef<MapActions>(null);

  useEffect(() => {
    const selectedEnv = environments.find((e) => e.name === environment);
    if (selectedEnv) {
      Object.entries(selectedEnv.presets).forEach(([key, value]) => {
        switch (key) {
          case "realtimeHighlighting":
            setRealtimeHighlighting(value as boolean);
            break;
          case "showCachedPolygons":
            setShowCachedPolygons(value as boolean);
            break;
          case "postXml":
            setPostXml(value as boolean);
            break;
          case "model":
            setModel(value as string);
            break;
          case "schemaName":
            setSchemaName(value as string);
            break;
          case "geojsonName":
            setGeojsonName(value as string);
            break;
        }
      });
    }
  }, [environment]);

  useEffect(() => {
    if (fetchError) {
      const timer = setTimeout(() => {
        setFetchError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchError]);

  const onRobotLoad = useCallback((robot: URDFRobot, initialJoints: Record<string, number>) => {
    setRobot(robot);
    setJointValues(initialJoints);
  }, []);

  const onJointChange = (jointName: string, value: number) => {
    setJointValues(prev => ({...prev, [jointName]: value}));
  };


  const handleFinalResult = async (xml: string) => {
    setInterimText(""); // Clear interim text when final result is received
    if (sessionName) {
      console.log("Session Name:", sessionName);
    }
    console.log(xml);
    setTaskXml(xml);
    setFetchError(null);
    if (postXml) {
      try {
        console.log("Fetching to endpoint...");
        const response = await fetch(`https://${deviceHost}/tcp`, {
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

  const selectedEnv = environments.find((e) => e.name === environment);

  return (
    <div className="relative w-screen h-screen">
      {environment === "Map (beta)" && (
        <MapView
          ref={mapRef}
          setInitialCenter={setInitialCenter}
          initialCenter={initialCenter}
          realtimeHighlighting={realtimeHighlighting}
          showCachedPolygons={showCachedPolygons}
        >
          <PathPlan xml={taskXml}/>
        </MapView>
      )}
      {environment === "Google Maps (beta)" && (
        <GoogleMapView
          ref={mapRef}
          setInitialCenter={setInitialCenter}
          initialCenter={initialCenter}
        />
      )}
      {selectedEnv?.urdf && selectedEnv.packages && (
        <KinovaKortexGen3View
          onRobotLoad={onRobotLoad}
          jointValues={jointValues}
          urdf={selectedEnv.urdf}
          packages={selectedEnv.packages}
          initialJoints={selectedEnv.initialJoints}
        />
      )}

      <EnvironmentDropdown environment={environment} setEnvironment={setEnvironment} />

      <SettingsPanel
        settings={selectedEnv?.settings}
        sessionName={sessionName}
        setSessionName={setSessionName}
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
        robot={robot}
        jointValues={jointValues}
        onJointChange={onJointChange}
      />

      <div className="fixed bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4 pointer-events-auto">
            {(environment === "Map (beta)" || environment === "Google Maps (beta)") && (
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
            initialCenter={initialCenter}
        />
      </div>
    </div>
  );
}
