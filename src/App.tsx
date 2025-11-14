import { useState, useRef, useEffect, useCallback } from "react";
import type { URDFRobot } from "urdf-loader";
import MapView, { MapActions } from "@/components/environments/map/MapView";
import GoogleMapView from "@/components/environments/google-map/GoogleMapView";
import GoogleMapPathPlan from "@/components/environments/google-map/GoogleMapPathPlan";
import KinovaKortexGen3View from "@/components/environments/kinova-kortex-gen3-6dof/KinovaKortexGen3View";
import PathPlan from "@/components/PathPlan";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextOrMicInput from "@/components/TextOrMicInput";
import { environments } from "@/lib/environments";
import XmlResponsePanel from "@/components/XmlResponsePanel";
import { APIProvider } from "@vis.gl/react-google-maps";

const DEMO_XML_RESPONSE = `<root BTCPP_format="4" schema_location="schemas/schemas/amiga_btcpp.xsd">
    <Mission>Drive the robot forward 5m and then left 4m</Mission>
    <BehaviorTree ID="main">
        <Sequence>
            <MoveToRelativeLocation name="DriveForward_5m" action_name="navigate_to_pose_in_frame" x="5" y="0" />
            <MoveToRelativeLocation name="MoveLeft_4m" action_name="navigate_to_pose_in_frame" x="0" y="4" />
        </Sequence>
    </BehaviorTree>
</root>`;

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);
  const [postXml, setPostXml] = useState<boolean>(false);
  const [deviceHost, setDeviceHost] = useState<string>(location.host);
  const [model, setModel] = useState<string>(localStorage.getItem("model") || "gpt-5/low");
  const [schemaName, setSchemaName] = useState<string>(localStorage.getItem("schemaName") || "amiga_btcpp");
  const [contextFiles, setContextFiles] = useState<string[]>(
    JSON.parse(localStorage.getItem("contextFiles") || "[]")
  );
  const [environment, setEnvironment] = useState<string>(localStorage.getItem("environment") || "Map (beta)");
  const [taskXml, setTaskXml] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [sessionName, setSessionName] = useState<string>("");
  const [showXmlPopup, setShowXmlPopup] = useState(false);
  const [xmlForPopup, setXmlForPopup] = useState("");

  const mapRef = useRef<MapActions>(null);
  const appDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (appDivRef.current) {
        appDivRef.current.style.height = `${window.innerHeight}px`;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSetEnvironment = (newEnvironment: string) => {
    setEnvironment(newEnvironment);
    localStorage.setItem("environment", newEnvironment);

    const selectedEnv = environments.find((e) => e.name === newEnvironment);
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
          case "model": {
            const newModel = value as string;
            setModel(newModel);
            localStorage.setItem("model", newModel);
            break;
          }
          case "schemaName": {
            const newSchemaName = value as string;
            setSchemaName(newSchemaName);
            localStorage.setItem("schemaName", newSchemaName);
            break;
          }
          case "contextFiles": {
            const newContextFiles = value as string[];
            setContextFiles(newContextFiles);
            localStorage.setItem("contextFiles", JSON.stringify(newContextFiles));
            break;
          }
        }
      });
    }
  };

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
    setXmlForPopup(xml);
    setShowXmlPopup(true);

    if (selectedEnv?.name === "Kinova Kortex Gen3 6DOF" && robot) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "application/xml");

      const atomicTasks = new Map<string, Element>();
      xmlDoc.querySelectorAll("AtomicTask").forEach(task => {
          const taskId = task.querySelector("TaskID")?.textContent;
          if (taskId) {
              atomicTasks.set(taskId, task);
          }
      });

      const sequenceTaskIds = Array.from(xmlDoc.querySelectorAll("ActionSequence Sequence TaskID")).map(el => el.textContent);

      let currentJointValues = {...jointValues};
      let delay = 0;

      const tasksToExecute = sequenceTaskIds.map(id => id ? atomicTasks.get(id) : undefined).filter((t): t is Element => !!t);

      for (const task of tasksToExecute) {
          const goToPosition = task.querySelector("goToPosition");
          if (goToPosition) {
              const movementType = goToPosition.querySelector('movement')?.textContent;

              const jointMap: Record<string, string> = {
                  'joint_1': 'x', 'joint_2': 'y', 'joint_3': 'z',
                  'joint_4': 'roll', 'joint_5': 'pitch', 'joint_6': 'yaw',
              };

              let changed = false;
              const nextJointValues = {...currentJointValues};

              for (const [jointName, tagName] of Object.entries(jointMap)) {
                  const valueStr = goToPosition.querySelector(tagName)?.textContent;
                  if (valueStr) {
                      const value = parseFloat(valueStr);
                      // XML is assumed to have degrees, model uses radians
                      const radValue = value * Math.PI / 180;
                      if (movementType === 'end_effector_link') {
                          nextJointValues[jointName] = (nextJointValues[jointName] || 0) + radValue;
                      } else { // 'base_link' or undefined is absolute
                          nextJointValues[jointName] = radValue;
                      }
                      changed = true;
                  }
              }

              if (changed) {
                  delay += 1000; // 1s delay between movements
                  setTimeout(() => {
                      setJointValues(nextJointValues);
                  }, delay);
                  currentJointValues = nextJointValues;
              }
          }
      }
    }

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

  const handleLoadDemoXml = () => {
    void handleFinalResult(DEMO_XML_RESPONSE);
  };

  const selectedEnv = environments.find((e) => e.name === environment);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const isMapLibreEnv = environment === "Map (beta)";
  const isGoogleMapsEnv = environment === "Google Maps";

  return (
    <div ref={appDivRef} className="relative w-screen">
      {isMapLibreEnv && (
        <MapView
          ref={mapRef}
          setInitialCenter={setInitialCenter}
          initialCenter={initialCenter}
          realtimeHighlighting={realtimeHighlighting}
          showCachedPolygons={showCachedPolygons}
        >
          <PathPlan xml={taskXml} origin={initialCenter}/>
        </MapView>
      )}
      {isGoogleMapsEnv && (
        apiKey ? (
          <APIProvider apiKey={apiKey} libraries={["places"]}>
            <GoogleMapView
              ref={mapRef}
              setInitialCenter={setInitialCenter}
              initialCenter={initialCenter}
            >
              <GoogleMapPathPlan xml={taskXml} origin={initialCenter} />
            </GoogleMapView>
            <div className="fixed top-4 right-4 z-30">
              <SearchPanel onPanTo={(coords) => mapRef.current?.panTo(coords)} />
            </div>
          </APIProvider>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <p className="p-4 text-center text-red-500">
              Google Maps API key is missing.
              <br />
              Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.
            </p>
          </div>
        )
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

      <div className="fixed top-4 left-4 z-20">
        <SettingsPanel
        settings={selectedEnv?.settings}
        environment={environment}
        setEnvironment={handleSetEnvironment}
        onLoadDemoXml={handleLoadDemoXml}
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
        contextFiles={contextFiles}
        setContextFiles={setContextFiles}
        robot={robot}
        jointValues={jointValues}
        onJointChange={onJointChange}
      />
      </div>

      {isMapLibreEnv && apiKey && (
        <div className="fixed top-4 right-4 z-30">
          <APIProvider apiKey={apiKey} libraries={["places"]}>
            <SearchPanel onPanTo={(coords) => mapRef.current?.panTo(coords)}/>
          </APIProvider>
        </div>
      )}

      <div className="fixed bottom-50 left-0 w-screen z-10 pointer-events-none flex flex-col items-center gap-2 p-4">
        {fetchError && (
          <div className="w-full max-w-xl">
            <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-xl shadow-lg">
              <p className="text-lg">{fetchError}</p>
            </div>
          </div>
        )}

        {interimText && (
          <div className="w-full max-w-[85%] mr-auto">
            <div className="bg-black/50 backdrop-blur-md text-white p-4 rounded-xl shadow-lg inline-block max-w-xl">
              <p className="text-lg"><em>"{interimText}"</em></p>
            </div>
          </div>
        )}
        <div className="w-full md:max-w-[70%]">
          <TextOrMicInput
              onSttResult={setInterimText}
              onFinalResult={handleFinalResult}
              model={model}
              schemaName={schemaName}
              contextFiles={contextFiles}
              setFetchError={setFetchError}
              initialCenter={initialCenter}
          />
        </div>
      </div>

      <XmlResponsePanel
        xml={xmlForPopup}
        isOpen={showXmlPopup}
        onClose={() => setShowXmlPopup(false)}
      />
    </div>
  );
}
