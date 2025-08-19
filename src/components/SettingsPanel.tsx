import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import type { URDFRobot, URDFJoint } from "urdf-loader";
import Panel from "./Panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Environment } from "@/lib/environments";

interface Props {
  settings: Environment['settings'] | undefined;
  environment: string;
  sessionName: string;
  setSessionName: (value: string) => void;
  realtimeHighlighting: boolean;
  setRealtimeHighlighting: (value: boolean) => void;
  showCachedPolygons: boolean;
  setShowCachedPolygons: (value: boolean) => void;
  postXml: boolean;
  setPostXml: (value: boolean) => void;
  deviceHost: string;
  setDeviceHost: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  schemaName: string;
  setSchemaName: (value: string) => void;
  geojsonName: string;
  setGeojsonName: (value: string) => void;
  robot: URDFRobot | null;
  jointValues: Record<string, number>;
  onJointChange: (jointName: string, value: number) => void;
}

export default function SettingsPanel({
  settings,
  environment,
  sessionName,
  setSessionName,
  realtimeHighlighting,
  setRealtimeHighlighting,
  showCachedPolygons,
  setShowCachedPolygons,
  postXml,
  setPostXml,
  deviceHost,
  setDeviceHost,
  model,
  setModel,
  schemaName,
  setSchemaName,
  geojsonName,
  setGeojsonName,
  robot,
  jointValues,
  onJointChange,
}: Props) {
  useEffect(() => {
    const storedDeviceHost = localStorage.getItem("deviceHost");
    if (storedDeviceHost) {
      setDeviceHost(storedDeviceHost);
    }
  }, []);

  const sliderModelOptions = [
    { id: "gpt-5-mini/low", displayName: "GPT-5 mini (low)" },
    { id: "gpt-5-mini/high", displayName: "GPT-5 mini (high)" },
    { id: "gpt-5/low", displayName: "GPT-5 (low)" },
    { id: "gpt-5/high", displayName: "GPT-5 (high)" },
  ];
  const modelValue = sliderModelOptions.findIndex(option => option.id === model);
  const sliderValue = modelValue === -1 ? 0 : modelValue;
  const currentModelDisplayName = sliderModelOptions.find(option => option.id === model)?.displayName || model;
  const schemaOptions = [
    { id: "bd_spot", displayName: "Boston Dynamics Spot" },
    { id: "clearpath_husky", displayName: "Clearpath Husky" },
    { id: "kinova_gen3_6dof", displayName: "Kinova Gen3 6DOF" },
    { id: "gazebo_minimal", displayName: "Gazebo Minimal" }
  ];
  const currentSchemaDisplayName = schemaOptions.find(option => option.id === schemaName)?.displayName || schemaName;
  const geojsonOptions = [
    { id: "none", displayName: "None" },
    { id: "reza", displayName: "Reza" },
    { id: "test", displayName: "Test" },
    { id: "ucm_graph40", displayName: "UCM Graph 40" },
  ];

  return (
    <Panel
      title="Settings"
      trigger={<FontAwesomeIcon icon={faGear} size="2xl" />}
    >
      {() => (
        <>
          <div className="flex-1 overflow-y-auto">
            {settings?.model && (
              <div className="flex items-start justify-between p-2">
                <label className="text-sm font-medium">Model</label>
                <div className="w-[200px]">
                  <Slider
                    value={[sliderValue]}
                    onValueChange={(value) => {
                      const newModel = sliderModelOptions[value[0]].id;
                      setModel(newModel);
                      localStorage.setItem("model", newModel);
                    }}
                    max={sliderModelOptions.length - 1}
                    step={1}
                  />
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground mt-1">Fast</span>
                    <span className="text-xs text-center mt-1 italic">{currentModelDisplayName}</span>
                    <span className="text-xs text-muted-foreground mt-1">Smart</span>
                  </div>
                </div>
              </div>
            )}
            {settings?.deviceSchema && (
              <div className="flex items-center justify-between p-2">
                <label className="text-sm font-medium">Device schema</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="size-10 w-[200px] font-normal">
                      {currentSchemaDisplayName}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuRadioGroup
                      value={schemaName}
                      onValueChange={(value) => {
                        setSchemaName(value);
                        localStorage.setItem("schemaName", value);
                      }}
                    >
                      {schemaOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.id} value={option.id}>
                          {option.displayName}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {settings?.sessionName && (
              <div className="flex items-center justify-between p-2">
                <label htmlFor="session-name" className="text-sm font-medium">
                  Session name
                </label>
                <Input
                  id="session-name"
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-[200px]"
                  placeholder="Optional"
                />
              </div>
            )}
            {settings?.sendToDevice && (
              <div className="flex items-center justify-between p-2">
                <label htmlFor="post-xml-to-endpoint" className="text-sm font-medium">
                  Send to device
                </label>
                <Checkbox
                  id="post-xml-to-endpoint"
                  checked={postXml}
                  onCheckedChange={setPostXml}
                />
              </div>
            )}
            {settings?.deviceHost && postXml && (
              <div className="flex items-center justify-between p-2">
                <label htmlFor="endpoint-url" className="text-sm font-medium">
                  Device host
                </label>
                <Input
                  id="endpoint-url"
                  type="text"
                  value={deviceHost}
                  onChange={(e) => {
                    setDeviceHost(e.target.value);
                    localStorage.setItem("deviceHost", e.target.value);
                  }}
                  className="w-[200px]"
                />
              </div>
            )}
            {settings?.kinova && robot && (
              <div className="border-t border-b border-border my-4 py-4 px-2 space-y-4">
                <h3 className="text-sm font-medium">Joints</h3>
                <ul className="space-y-4">
                  {Object.values(robot.joints)
                    .filter((joint: URDFJoint) => joint.jointType !== "fixed")
                    .map((joint: URDFJoint) => {
                      const min =
                        joint.jointType === "continuous"
                          ? -2 * Math.PI
                          : joint.limit.lower;
                      const max =
                        joint.jointType === "continuous"
                          ? 2 * Math.PI
                          : joint.limit.upper;
                      const value = jointValues[joint.name] || 0;
                      return (
                        <li key={joint.name}>
                          <label
                            className="block text-xs font-medium truncate mb-1"
                            title={joint.name}
                          >
                            {joint.name}
                          </label>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="range"
                              min={min}
                              max={max}
                              step="0.001"
                              value={value}
                              onChange={(e) =>
                                onJointChange(joint.name, parseFloat(e.target.value))
                              }
                              className="w-full h-auto"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={(value * (180 / Math.PI)).toFixed(1)}
                              onChange={(e) =>
                                onJointChange(
                                  joint.name,
                                  parseFloat(e.target.value) * (Math.PI / 180)
                                )
                              }
                              className="w-20"
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            {(settings?.realtimeHighlighting || settings?.showCachedPolygons || settings?.geojsonFile) && (
              <div className="border-t border-border my-4 py-4 px-2 space-y-4">
                {settings?.realtimeHighlighting && (
                  <div className="flex items-center justify-between p-2">
                    <label htmlFor="realtime-rendering" className="text-sm font-medium">
                      Realtime feature highlighting
                    </label>
                    <Checkbox
                      id="realtime-rendering"
                      checked={realtimeHighlighting}
                      onCheckedChange={setRealtimeHighlighting}
                    />
                  </div>
                )}
                {settings?.showCachedPolygons && (
                  <div className="flex items-center justify-between p-2">
                    <label htmlFor="show-cached-polygons" className="text-sm font-medium">
                      Show cached polygons (debug)
                    </label>
                    <Checkbox
                      id="show-cached-polygons"
                      checked={showCachedPolygons}
                      onCheckedChange={setShowCachedPolygons}
                    />
                  </div>
                )}
                {settings?.geojsonFile && (
                  <div className="flex items-center justify-between p-2">
                    <label className="text-sm font-medium">GeoJSON File</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="size-10 w-[200px] font-normal">
                          {geojsonOptions.find((o) => o.id === geojsonName)?.displayName}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuRadioGroup
                          value={geojsonName}
                          onValueChange={(value) => {
                            setGeojsonName(value);
                            localStorage.setItem("geojsonName", value);
                          }}
                        >
                          {geojsonOptions.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.id}
                              value={option.id}
                            >
                              {option.displayName}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 text-center text-xs text-muted-foreground">
            Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics
          </div>
        </>
      )}
    </Panel>
  );
}
