import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import Panel from "./Panel";

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
              <input
                type="checkbox"
                id="realtime-rendering"
                className="h-5 w-5 rounded"
                checked={realtimeHighlighting}
                onChange={(e) => setRealtimeHighlighting(e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label htmlFor="show-cached-polygons" className="text-sm font-medium">
                Show cached polygons (debug)
              </label>
              <input
                type="checkbox"
                id="show-cached-polygons"
                className="h-5 w-5 rounded"
                checked={showCachedPolygons}
                onChange={(e) => setShowCachedPolygons(e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label htmlFor="post-xml-to-endpoint" className="text-sm font-medium">
                POST XML to endpoint
              </label>
              <input
                type="checkbox"
                id="post-xml-to-endpoint"
                className="h-5 w-5 rounded"
                checked={postXmlToEndpoint}
                onChange={(e) => setPostXmlToEndpoint(e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between p-2">
              <label htmlFor="model-select" className="text-sm font-medium">
                Model
              </label>
              <select
                id="model-select"
                className="rounded border bg-background px-2 py-1 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="o3-high">o3-high</option>
                <option value="o3-low">o3-low</option>
                <option value="o4-mini-high">o4-mini-high</option>
                <option value="o4-mini-low">o4-mini-low</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4.1-nano">gpt-4.1-nano</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2">
              <label htmlFor="geojson-select" className="text-sm font-medium">
                GeoJSON File
              </label>
              <select
                id="geojson-select"
                className="rounded border bg-background px-2 py-1 text-sm"
                value={geojsonName}
                onChange={(e) => setGeojsonName(e.target.value)}
              >
                <option value="">None</option>
                <option value="reza">reza</option>
                <option value="ucm_graph40">ucm_graph40</option>
              </select>
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
