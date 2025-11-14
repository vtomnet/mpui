import { useEffect, useMemo, useRef } from "react";
import type { FC } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { Feature, LineString, Point } from "geojson";
import {
  almostEqualCoord,
  buildPlanGeometry,
  createEmptyCollection,
} from "../../../lib/missionPlan";

interface Props {
  xml: string;
  origin: [number, number] | null;
}

const MAX_PLAN_ZOOM = 18;

const markerStyles = {
  start: {
    size: 48,
    fill: "#ffffff",
    borderWidth: 4,
    textColor: "#000000",
  },
  orientation: {
    size: 36,
    fill: "#3385ff",
    borderWidth: 3,
    textColor: "#ffffff",
  },
  default: {
    size: 42,
    fill: "#33ff33",
    borderWidth: 3,
    textColor: "#0b280b",
  },
} as const;

type MarkerVisualStyle = typeof markerStyles[keyof typeof markerStyles];

const getMarkerStyle = (type: string | undefined): MarkerVisualStyle => {
  if (type === "start") return markerStyles.start;
  if (type === "orientation") return markerStyles.orientation;
  return markerStyles.default;
};

const GoogleMapPathPlan: FC<Props> = ({ xml, origin }) => {
  const map = useMap();
  const lastFitKeyRef = useRef<string>("");

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

  useEffect(() => {
    if (!map) return;
    if (typeof google === "undefined" || !google.maps?.OverlayView) return;

    const features = plan.featureCollection.features;
    const pointFeatures = features.filter(
      (feature): feature is Feature<Point> => feature.geometry.type === "Point",
    );
    const pathFeature = features.find(
      (feature): feature is Feature<LineString> =>
        feature.geometry.type === "LineString" &&
        feature.properties?.type === "path",
    );

    const markers: google.maps.Marker[] = [];
    let mainPolyline: google.maps.Polyline | null = null;
    const markerLabels: google.maps.OverlayView[] = [];

    if (pathFeature && pathFeature.geometry.coordinates.length >= 2) {
      const path = pathFeature.geometry.coordinates.map(([lon, lat]) => ({
        lng: lon,
        lat,
      }));
      mainPolyline = new google.maps.Polyline({
        path,
        strokeOpacity: 0,
        strokeColor: "#33ff33",
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: "M 0 -1 0 1",
              strokeOpacity: 1,
              strokeWeight: 3,
              strokeColor: "#33ff33",
              scale: 2.5,
            },
            offset: "0",
            repeat: "16px",
          },
        ],
        });
      mainPolyline.setMap(map);
    }

    const MarkerLabel = class extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private readonly position: google.maps.LatLngLiteral;
      private readonly text: string;
      private readonly zIndex: number;

      constructor(position: google.maps.LatLngLiteral, text: string, zIndex: number) {
        super();
        this.position = position;
        this.text = text;
        this.zIndex = zIndex;
      }

      onAdd(): void {
        this.div = document.createElement("div");
        this.div.textContent = this.text;
        this.div.style.position = "absolute";
        this.div.style.transform = "translate(-50%, 16px)";
        this.div.style.whiteSpace = "nowrap";
        this.div.style.color = "#ffffff";
        this.div.style.fontWeight = "600";
        this.div.style.fontSize = "13px";
        this.div.style.textShadow = [
          "-1px 0 0 rgba(0,0,0,0.75)",
          "1px 0 0 rgba(0,0,0,0.75)",
          "0 -1px 0 rgba(0,0,0,0.75)",
          "0 1px 0 rgba(0,0,0,0.75)",
        ].join(", ");
        this.div.style.pointerEvents = "none";
        this.div.style.zIndex = `${this.zIndex}`;

        const panes = this.getPanes();
        panes?.overlayImage.appendChild(this.div);
      }

      draw(): void {
        if (!this.div) return;
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(this.position.lat, this.position.lng),
        );
        if (!point) return;
        this.div.style.left = `${point.x}px`;
        this.div.style.top = `${point.y}px`;
      }

      onRemove(): void {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
        }
        this.div = null;
      }
    };

    pointFeatures.forEach((feature, idx) => {
      const [lon, lat] = feature.geometry.coordinates;
      const position = { lat, lng: lon };
      const style = getMarkerStyle(feature.properties?.type as string | undefined);
      const labelText = feature.properties?.label as string | undefined;
      const labelZIndex = 2000 - idx;
      const marker = new google.maps.Marker({
        map,
        position,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: style.fill,
          fillOpacity: 1,
          strokeColor: "#000000",
          strokeOpacity: 1,
          strokeWeight: style.borderWidth,
          scale: style.size / 2,
        },
        label: feature.properties?.index
          ? {
              text: String(feature.properties.index),
              color: style.textColor,
              fontWeight: "700",
              fontSize: `${Math.max(14, Math.round(style.size * 0.42))}px`,
            }
          : undefined,
        title: [feature.properties?.label, feature.properties?.details]
          .filter(Boolean)
          .join(" — ") || undefined,
        zIndex: 1000 - idx,
      });

      markers.push(marker);

      if (labelText) {
        const label = new MarkerLabel(position, labelText, labelZIndex);
        label.setMap(map);
        markerLabels.push(label);
      }
    });

    return () => {
      markers.forEach((marker) => {
        marker.setMap(null);
      });
      markerLabels.forEach((label) => {
        label.setMap(null);
      });
      if (mainPolyline) {
        mainPolyline.setMap(null);
      }
    };
  }, [map, plan]);

  useEffect(() => {
    if (!map) return;

    const fitKey = `${xml}__${origin ? origin.join(",") : ""}`;
    const coordinates = plan.coordinates;

    const hasMeaningfulDistance = coordinates.some(
      (coord, index, coords) =>
        index > 0 && !almostEqualCoord(coord, coords[index - 1]),
    );

    if (coordinates.length > 1 && hasMeaningfulDistance && fitKey !== lastFitKeyRef.current) {
      const bounds = new google.maps.LatLngBounds();
      coordinates.forEach(([lon, lat]) => bounds.extend({ lat, lng: lon }));

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 80);

        const idleListener = google.maps.event.addListenerOnce(map, "idle", () => {
          const currentZoom = map.getZoom();
          if (currentZoom && currentZoom > MAX_PLAN_ZOOM) {
            map.setZoom(MAX_PLAN_ZOOM);
          }
        });

        lastFitKeyRef.current = fitKey;

        return () => {
          google.maps.event.removeListener(idleListener);
        };
      }
    }

    return undefined;
  }, [map, plan.coordinates, xml, origin]);

  return null;
};

export default GoogleMapPathPlan;
