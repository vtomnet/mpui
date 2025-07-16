import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
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

interface Props {
  realtimeHighlighting: boolean;
  setRealtimeHighlighting: (value: boolean) => void;
  showCachedPolygons: boolean;
  setShowCachedPolygons: (value: boolean) => void;
  postXmlToEndpoint: boolean;
  setPostXmlToEndpoint: (value: boolean) => void;
  model: string;
  setModel: (value: string) => void;
  geojsonName: string;
  setGeojsonName: (value: string) => void;
}

export default function SettingsPanel({
  realtimeHighlighting,
  setRealtimeHighlighting,
  showCachedPolygons,
  setShowCachedPolygons,
  postXmlToEndpoint,
  setPostXmlToEndpoint,
  model,
  setModel,
  geojsonName,
  setGeojsonName,
}: Props) {
  const modelOptions = [
    "o3-high",
    "o3-low",
    "o4-mini-high",
    "o4-mini-low",
    "gpt-4.1",
    "gpt-4.1-nano",
  ];
  const geojsonOptions = [
    { value: "", label: "None" },
    { value: "reza", label: "reza" },
    { value: "ucm_graph40", label: "ucm_graph40" },
  ];

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
                POST XML to endpoint
              </label>
              <Checkbox
                id="post-xml-to-endpoint"
                checked={postXmlToEndpoint}
                onCheckedChange={setPostXmlToEndpoint}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label className="text-sm font-medium">Model</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[150px] font-normal">
                    {model}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[150px]">
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
              <label className="text-sm font-medium">GeoJSON File</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[150px] font-normal">
                    {geojsonOptions.find((o) => o.value === geojsonName)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[150px]">
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
