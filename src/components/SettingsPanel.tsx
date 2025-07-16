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
}

export default function SettingsPanel({
  realtimeHighlighting,
  setRealtimeHighlighting,
  showCachedPolygons,
  setShowCachedPolygons,
  postXmlToEndpoint,
  setPostXmlToEndpoint,
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
          </div>

          <div className="mt-auto pt-4 text-center text-xs text-muted-foreground">
            Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics
          </div>
        </>
      )}
    </Panel>
  );
}
