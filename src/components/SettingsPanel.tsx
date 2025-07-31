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

interface Props {
  runName: string;
  setRunName: (value: string) => void;
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
  environment: string;
  setEnvironment: (value: string) => void;
  robot: URDFRobot | null;
  jointValues: Record<string, number>;
  onJointChange: (jointName: string, value: number) => void;
}

export default function SettingsPanel({
  runName,
  setRunName,
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
  environment,
  setEnvironment,
  robot,
  jointValues,
  onJointChange,
}: Props) {
  const modelOptions = [
    "o3/low",
    "o3/medium",
    "o3/high",

    "o4-mini/low",
    "o4-mini/medium",
    "o4-mini/high",

    "gpt-4.1-nano",
    "gpt-4.1-mini",
    "gpt-4.1",

    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ];
  const schemaOptions = [
    "bd_spot",
    "clearpath_husky",
    "kinova_gen3_6dof",
    "gazebo_minimal"
  ];
  const geojsonOptions = [
    { value: "", label: "None" },
    { value: "reza", label: "reza" },
    { value: "test", label: "test" },
    { value: "ucm_graph40", label: "ucm_graph40" },
  ];
  const environmentOptions = ["none", "map", "kinova_kortex_gen3_6dof"];

  return (
    <Panel
      title="Settings"
      trigger={<FontAwesomeIcon icon={faGear} size="2xl" />}
      triggerClassName="fixed top-4 right-4 z-10"
    >
      {() => (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between p-2">
              <label htmlFor="run-name" className="text-sm font-medium">
                Session name
              </label>
              <Input
                id="run-name"
                type="text"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="flex items-center justify-between p-2">
              <label className="text-sm font-medium">Environment</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="size-10 w-[200px] font-normal">
                    {environment}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuRadioGroup
                    value={environment}
                    onValueChange={setEnvironment}
                  >
                    {environmentOptions.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {environment === "kinova_kortex_gen3_6dof" && robot && (
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

            <div className="flex items-center justify-between p-2">
              <label htmlFor="post-xml-to-endpoint" className="text-sm font-medium">
                Send XML to device
              </label>
              <Checkbox
                id="post-xml-to-endpoint"
                checked={postXml}
                onCheckedChange={setPostXml}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label htmlFor="endpoint-url" className="text-sm font-medium">
                Device host
              </label>
              <Input
                id="endpoint-url"
                type="text"
                value={deviceHost}
                onChange={(e) => setDeviceHost(e.target.value)}
                className="w-[200px]"
                disabled={!postXml}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label className="text-sm font-medium">Model</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="size-10 w-[200px] font-normal">
                    {model}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                    {modelOptions.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center justify-between p-2">
              <label className="text-sm font-medium">Robot Schema</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="size-10 w-[200px] font-normal">
                    {schemaName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuRadioGroup value={schemaName} onValueChange={setSchemaName}>
                    {schemaOptions.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center justify-between p-2">
              <label className="text-sm font-medium">GeoJSON File</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="size-10 w-[200px] font-normal">
                    {geojsonOptions.find((o) => o.value === geojsonName)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuRadioGroup
                    value={geojsonName}
                    onValueChange={setGeojsonName}
                  >
                    {geojsonOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-auto pt-4 text-center text-xs text-muted-foreground">
            Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics
          </div>
        </>
      )}
    </Panel>
  );
}
