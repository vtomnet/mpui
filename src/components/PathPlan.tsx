import { useEffect, useMemo } from "react";
import { useMap } from "./environments/map/MapContext";
import { LngLatBounds, GeoJSONSource } from "maplibre-gl"
import type { Feature, Point, LineString } from "geojson";

interface Props {
  xml: string;
}

const PathPlan: React.FC<Props> = ({ xml }) => {
  return null;
  // const { map, isMapReady } = useMap();
  // const graph = useMemo(() => (xml ? parseTaskPlan(xml) : undefined), [xml]);

  // useEffect(() => {
  //   if (!map || !isMapReady || !map.isStyleLoaded()) return;

  //   const source = map.getSource('graph') as GeoJSONSource;
  //   if (!source) return;

  //   if (!graph) {
  //     source.setData({ type: 'FeatureCollection', features: [] });
  //     return;
  //   }

  //   const lineFeatures: Feature<LineString>[] = [];
  //   const pointFeatures: Feature<Point>[] = [];
  //   const hasGeometry = (id: string) => Boolean(graph.nodes[id]?.geometry);
  //   const graphBounds = new LngLatBounds();

  //   graph.edges.filter(e => hasGeometry(e.from) && hasGeometry(e.to)).forEach(e => {
  //     const a = graph.nodes[e.from].geometry!;
  //     const b = graph.nodes[e.to].geometry!;
  //     lineFeatures.push({ type: 'Feature', properties: { label: e.label }, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] } });
  //   });

  //   Object.values(graph.nodes).filter(n => n.geometry).forEach(n => {
  //     const coords: [number, number] = [n.geometry!.lon, n.geometry!.lat];
  //     pointFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coords } });
  //     graphBounds.extend(coords);
  //   });

  //   source.setData({ type: 'FeatureCollection', features: [...lineFeatures, ...pointFeatures] });

  //   if (lineFeatures.length > 0 && !graphBounds.isEmpty()) {
  //     map.fitBounds(graphBounds, { padding: 40, maxZoom: 18 });
  //   }
  // }, [graph, map, isMapReady]);

  // return null; // This component does not render anything itself
};

export default PathPlan;
