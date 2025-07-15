import { useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faGear } from '@fortawesome/free-solid-svg-icons';
import { Button } from "@/components/ui/button";

interface Props {
  realtimeHighlighting: boolean;
  setRealtimeHighlighting: (value: boolean) => void;
  showCachedPolygons: boolean;
  setShowCachedPolygons: (value: boolean) => void;
}

export default function SettingsPanel({
  realtimeHighlighting,
  setRealtimeHighlighting,
  showCachedPolygons,
  setShowCachedPolygons,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-10">
        <Button onClick={() => setIsOpen(true)} variant="secondary" className="size-12 rounded-full p-0">
          <FontAwesomeIcon icon={faGear} size="xl" />
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-2xl h-full max-h-[80vh] rounded-lg p-4 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <h2 className="text-xl font-bold">Settings</h2>
              <Button onClick={() => setIsOpen(false)} variant="ghost" className="size-8 p-0">
                <FontAwesomeIcon icon={faTimes} />
              </Button>
            </div>

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
            </div>

            <div className="mt-auto pt-4 text-center text-xs text-muted-foreground">
              Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics
            </div>
          </div>
        </div>
      )}
    </>
  );
}
