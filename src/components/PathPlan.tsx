import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMap } from "./environments/map/MapContext";
import { DEFAULT_MAP_ZOOM } from "./environments/map/MapView";
import { LngLatBounds, GeoJSONSource } from "maplibre-gl";
import type { Feature, Point, LineString } from "geojson";
import {
  almostEqualCoord,
  buildPlanGeometry,
  createEmptyCollection,
  type PlanGeometry,
} from "../lib/missionPlan";

interface Props {
  xml: string;
  origin: [number, number] | null;
}

const PathPlan: React.FC<Props> = ({ xml, origin }) => {
  const { map, isMapReady } = useMap();
  const lastFitKeyRef = useRef<string>("");
  const planRef = useRef<PlanGeometry>({
    featureCollection: createEmptyCollection(),
    coordinates: [],
  });

  const plan = useMemo(() => {
    if (!origin) {
      return { featureCollection: createEmptyCollection(), coordinates: [] };
    }
    return (
      buildPlanGeometry(xml, origin) ?? {
        featureCollection: createEmptyCollection(),
        coordinates: [],
      }
    );
  }, [xml, origin]);

  planRef.current = plan;

  const ensureGraphLayers = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return false;

    if (!map.getSource("graph")) {
      map.addSource("graph", {
        type: "geojson",
        data: createEmptyCollection(),
      });
    }

    if (!map.getLayer("graph-lines")) {
      map.addLayer({
        id: "graph-lines",
        type: "line",
        source: "graph",
        filter: ["==", "$type", "LineString"],
        paint: {
          "line-width": 3.5,
          "line-color": "#33ff33",
          "line-dasharray": [2, 2],
        },
      });
    }

    if (!map.getLayer("graph-points")) {
      map.addLayer({
        id: "graph-points",
        type: "circle",
        source: "graph",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "type"], "start"],
            22,
            ["==", ["get", "type"], "orientation"],
            16,
            20,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "type"], "start"],
            "#ffffff",
            ["==", ["get", "type"], "orientation"],
            "#3385ff",
            "#33ff33",
          ],
          "circle-stroke-color": "#000000",
          "circle-stroke-width": [
            "case",
            ["==", ["get", "type"], "start"],
            4,
            2.4,
          ],
        },
      });
    }

    if (!map.getLayer("graph-labels")) {
      map.addLayer({
        id: "graph-labels",
        type: "symbol",
        source: "graph",
        filter: ["==", "$type", "Point"],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 15,
          "text-font": ["Open Sans Semibold"],
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.85)",
          "text-halo-width": 2,
        },
      });
    }

    return true;
  }, [map]);

  useEffect(() => {
    if (!map || !isMapReady) return;

    const reapplyPlan = () => {
      if (!map.isStyleLoaded()) return;
      if (!ensureGraphLayers()) return;

      const source = map.getSource("graph") as GeoJSONSource | undefined;
      if (!source) return;
      source.setData(planRef.current.featureCollection);
    };

    map.on("styledata", reapplyPlan);
    return () => {
      map.off("styledata", reapplyPlan);
    };
  }, [map, isMapReady, ensureGraphLayers]);

  useEffect(() => {
    if (!map || !isMapReady || !map.isStyleLoaded()) return;
    if (!ensureGraphLayers()) return;
    const source = map.getSource("graph") as GeoJSONSource | undefined;
    if (!source) return;

    source.setData(plan.featureCollection);

    const fitKey = `${xml}__${origin ? origin.join(",") : ""}`;

    const hasMeaningfulDistance = plan.coordinates.some(
      (coord, index, coords) =>
        index > 0 && !almostEqualCoord(coord, coords[index - 1]),
    );

    if (plan.coordinates.length > 1 && hasMeaningfulDistance && fitKey !== lastFitKeyRef.current) {
      const bounds = plan.coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new LngLatBounds(plan.coordinates[0], plan.coordinates[0]),
      );
      if (!bounds.isEmpty()) {
        const maxZoom = Math.min(DEFAULT_MAP_ZOOM, map.getMaxZoom());
        map.fitBounds(bounds, { padding: 80, maxZoom, duration: 800 });
      }
    }

    lastFitKeyRef.current = fitKey;
  }, [map, isMapReady, plan, xml, origin, ensureGraphLayers]);

  return null;
};

export default PathPlan;
