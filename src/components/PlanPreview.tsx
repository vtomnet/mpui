import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Map as LibreMap, MapMouseEvent, LngLat, LngLatBounds, GeoJSONSource } from 'maplibre-gl';
import type { Feature, Point, LineString, Polygon } from 'geojson';
import { parseTaskPlan } from '../../lib/taskPlanParser';

export interface Snapshot {
  image: string;
  northWest: [number, number];
  northEast: [number, number];
  southWest: [number, number];
  southEast: [number, number];
  center: [number, number];
  width: number;
  height: number;
}

export interface PlanPreviewActions {
  takeSnapshot: () => Snapshot | null;
  panTo: (lonLat: [number, number]) => void;
}

function getDist(a: LngLat, b: LngLat): number {
  const dx = a.lng - b.lng;
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

function useRafThrottle() {
  const ticking = useRef(false);
  return (cb: () => void) => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      cb();
      ticking.current = false;
    });
  };
}

const PlanPreview = forwardRef<PlanPreviewActions, { xml: string; initialCenter: [number, number] | null, realtimeHighlighting: boolean, showCachedPolygons: boolean }>(
  ({ xml, initialCenter, realtimeHighlighting, showCachedPolygons }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LibreMap | null>(null);
    const highlightIdRef = useRef<string | null>(null);
    const [warningMessage, setWarningMessage] = useState('');
    const [mapReady, setMapReady] = useState(false);
    const fetchingRef = useRef(false);
    const cachedFeaturesRef = useRef<Map<string, Feature<Polygon>>>(new Map());
    const cachedExtentRef = useRef<LngLatBounds | null>(null);
    const throttle = useRafThrottle();
    const onPointerMoveHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null);
    const graph = useMemo(() => (xml ? parseTaskPlan(xml) : undefined), [xml]);

    const getGeoJSONFeatureBounds = (feature: Feature): LngLatBounds | null => {
      if (!feature.geometry || feature.geometry.type !== 'Polygon') return null;
      const coords = feature.geometry.coordinates[0];
      if (!coords || coords.length === 0) return null;
      const bounds = new LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]);
      for (const coord of coords) {
        bounds.extend(coord as [number, number]);
      }
      return bounds;
    };

    const boundsIntersect = (a: LngLatBounds, b: LngLatBounds) => {
      const aSw = a.getSouthWest();
      const aNe = a.getNorthEast();
      const bSw = b.getSouthWest();
      const bNe = b.getNorthEast();

      return (
        aSw.lng <= bNe.lng &&
        aNe.lng >= bSw.lng &&
        aSw.lat <= bNe.lat &&
        aNe.lat >= bSw.lat
      );
    }

    const selectBestFeature = (features: Iterable<Feature<Polygon>>, viewBounds: LngLatBounds): Feature<Polygon> | null => {
      let best: { feature: Feature<Polygon>; score: number } | null = null;
      const mapCenter = viewBounds.getCenter();
      const mapNe = viewBounds.getNorthEast();
      const mapSw = viewBounds.getSouthWest();
      const mapArea = (mapNe.lng - mapSw.lng) * (mapNe.lat - mapSw.lat);
      if (mapArea <= 0) return null;
      const maxDist = getDist(mapCenter, mapNe);

      for (const feature of features) {
        const fBounds = getGeoJSONFeatureBounds(feature);
        if (!fBounds || !boundsIntersect(fBounds, viewBounds)) continue;
        const fNe = fBounds.getNorthEast();
        const fSw = fBounds.getSouthWest();
        const featureArea = (fNe.lng - fSw.lng) * (fNe.lat - fSw.lat);
        if (featureArea === 0) continue;
        const intersection = new LngLatBounds([Math.max(mapSw.lng, fSw.lng), Math.max(mapSw.lat, fSw.lat)], [Math.min(mapNe.lng, fNe.lng), Math.min(mapNe.lat, fNe.lat)]);
        const iNe = intersection.getNorthEast();
        const iSw = intersection.getSouthWest();
        const intersectionArea = (iNe.lng - iSw.lng) * (iNe.lat - iSw.lat);
        const visibleCenter = intersection.getCenter();
        const distScore = 1 - getDist(mapCenter, visibleCenter) / maxDist;
        const coverageScore = intersectionArea / featureArea;
        const viewportScore = intersectionArea / mapArea;
        const score = 0.25 * coverageScore + 0.25 * viewportScore + 0.5 * distScore;
        if (!best || score > best.score) best = { feature, score };
      }
      return best?.feature ?? null;
    };

    const setHighlightedId = (id: string | number | null) => {
      const map = mapRef.current;
      const strId = id?.toString() ?? null;
      if (!map || !map.isStyleLoaded() || highlightIdRef.current === strId) return;

      if (highlightIdRef.current) {
        map.setFeatureState({ source: 'farmland', id: highlightIdRef.current }, { highlighted: false });
      }
      if (strId) {
        map.setFeatureState({ source: 'farmland', id: strId }, { highlighted: true });
      }
      highlightIdRef.current = strId;
    };

    useImperativeHandle(ref, () => ({
      panTo(lonLat) {
        mapRef.current?.flyTo({ center: lonLat, zoom: 17 });
      },
      takeSnapshot: () => {
        const map = mapRef.current;
        if (!map) return null;
        const canvas = map.getCanvas();
        const bounds = map.getBounds();
        return {
          image: canvas.toDataURL(),
          northWest: [bounds.getWest(), bounds.getNorth()],
          northEast: [bounds.getEast(), bounds.getNorth()],
          southWest: [bounds.getWest(), bounds.getSouth()],
          southEast: [bounds.getEast(), bounds.getSouth()],
          center: [map.getCenter().lng, map.getCenter().lat],
          width: canvas.width,
          height: canvas.height,
        };
      },
    }));

    useEffect(() => {
      if (!containerRef.current || mapRef.current || !initialCenter) return;

      const map = new LibreMap({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' },
            labels: { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri' },
            farmland: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'OBJECTID' },
            'cached-polygons-debug': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            graph: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          },
          layers: [
            { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 },
            { id: 'labels', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 22 },
            {
              id: 'cached-polygons-debug-outline',
              type: 'line',
              source: 'cached-polygons-debug',
              paint: { 'line-color': 'red', 'line-width': 1 },
              layout: { visibility: 'none' },
            },
            {
              id: 'farmland-outline', type: 'line', source: 'farmland',
              paint: { 'line-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], 'rgba(255,255,0,0.7)', 'rgba(0,0,0,0)'], 'line-width': 3 },
            },
            {
              id: 'graph-lines', type: 'line', source: 'graph', filter: ['==', '$type', 'LineString'],
              // paint: { 'line-width': 2, 'line-color': 'black', 'line-dasharray': ['case', ['==', ['get', 'label'], 'true'], ['literal', [10, 10]], ['==', ['get', 'label'], 'false'], ['literal', [2, 12]], ['literal', []]] } // FIXME
            },
            { id: 'graph-points', type: 'circle', source: 'graph', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': 'black' } }
          ],
        },
        center: initialCenter, zoom: 18,
      });
      mapRef.current = map;

      const fetchAndCache = async (bounds: LngLatBounds): Promise<boolean> => {
        if (fetchingRef.current) return false;
        fetchingRef.current = true;
        let added = false;
        try {
          const center = bounds.getCenter();
          const w = bounds.getEast() - bounds.getWest();
          const h = bounds.getNorth() - bounds.getSouth();
          const factor = 3;
          const fetchBounds = new LngLatBounds(
            [center.lng - (w * factor) / 2, center.lat - (h * factor) / 2],
            [center.lng + (w * factor) / 2, center.lat + (h * factor) / 2],
          );

          const url = new URL('https://utility.arcgis.com/usrsvcs/servers/5e2c0fc60c8741729b9e6852929445a4/rest/services/Planning/i15_Crop_Mapping_2023_Provisional/MapServer/0/query');
          url.search = new URLSearchParams({
            geometry: fetchBounds.toArray().flat().join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
            spatialRel: 'esriSpatialRelIntersects', outFields: 'OBJECTID', returnGeometry: 'true',
            where: "SYMB_CLASS NOT IN ('I', 'U', 'UL', 'X')", f: 'geojson',
          }).toString();

          const res = await fetch(url.toString());
          if (res.ok) {
            const json = await res.json();
            if (json.features?.length) {
              json.features.forEach((f: Feature<Polygon>) => {
                const id = f.properties?.OBJECTID;
                if (id && !cachedFeaturesRef.current.has(id.toString())) {
                  f.id = id; // promoteId needs top-level id
                  cachedFeaturesRef.current.set(id.toString(), f);
                  added = true;
                }
              });
              if(added) {
                const collection = { type: 'FeatureCollection', features: Array.from(cachedFeaturesRef.current.values()) };
                (map.getSource('farmland') as GeoJSONSource)?.setData(collection);
                (map.getSource('cached-polygons-debug') as GeoJSONSource)?.setData(collection);
              }
            }
            if (!cachedExtentRef.current) {
              cachedExtentRef.current = fetchBounds;
            } else {
              cachedExtentRef.current.extend(fetchBounds);
            }
          } else {
            console.error('Cropland query failed', res.status, res.statusText);
          }
        } catch (e) {
          console.error('Cropland query failed', e);
        } finally { fetchingRef.current = false; }
        return added;
      };

      const onPointerMove = (e: MapMouseEvent) => {
        throttle(() => {
          const best = selectBestFeature(cachedFeaturesRef.current.values(), map.getBounds());
          setHighlightedId(best?.properties?.OBJECTID ?? null);
        });
      };
      onPointerMoveHandlerRef.current = onPointerMove;

      const onMoveEnd = async () => {
        const bounds = map.getBounds();
        const cacheMiss = !cachedExtentRef.current || !cachedExtentRef.current.contains(bounds.getCenter());
        if (cacheMiss) {
          console.log("CACHE MISS");
          await fetchAndCache(bounds);
        } else if (cachedExtentRef.current) {
          const swDist = getDist(bounds.getSouthWest(), cachedExtentRef.current.getSouthWest());
          const neDist = getDist(bounds.getNorthEast(), cachedExtentRef.current.getNorthEast());
          if (swDist > neDist*2 || neDist > swDist*2) fetchAndCache(bounds); // very rough "near edge"
        }
        const best = selectBestFeature(cachedFeaturesRef.current.values(), bounds);
        if (best) { setWarningMessage(''); setHighlightedId(best.properties?.OBJECTID ?? null); }
        else { setWarningMessage("These aren't the fields you're looking for."); setHighlightedId(null); }
      };

      map.on('load', () => {
        setMapReady(true);
        map.on('moveend', onMoveEnd);
        map.on('movestart', () => setWarningMessage('')); onMoveEnd();
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
    }, [initialCenter]);

    useEffect(() => {
      const map = mapRef.current;
      const handler = onPointerMoveHandlerRef.current;
      if (!map || !handler || !mapReady) return;
      if (realtimeHighlighting) {
        map.on('move', handler);
        return () => { map.off('move', handler); };
      }
    }, [realtimeHighlighting, mapReady]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      map.setLayoutProperty(
        'cached-polygons-debug-outline',
        'visibility',
        showCachedPolygons ? 'visible' : 'none'
      );
    }, [showCachedPolygons, mapReady]);

    useEffect(() => {
      const source = mapRef.current?.getSource('graph') as GeoJSONSource;
      if (!source) return;
      if (!graph) { source.setData({ type: 'FeatureCollection', features: [] }); return; }

      const lineFeatures: Feature<LineString>[] = [];
      const pointFeatures: Feature<Point>[] = [];
      const hasGeometry = (id: string) => Boolean(graph.nodes[id].geometry);
      const graphBounds = new LngLatBounds();

      graph.edges.filter((e) => hasGeometry(e.from) && hasGeometry(e.to)).forEach((e) => {
        const a = graph.nodes[e.from].geometry!;
        const b = graph.nodes[e.to].geometry!;
        lineFeatures.push({ type: 'Feature', properties: { label: e.label }, geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] } });
      });

      Object.values(graph.nodes).filter((n) => n.geometry).forEach((n) => {
        const coords: [number, number] = [n.geometry!.lon, n.geometry!.lat];
        pointFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coords } });
        graphBounds.extend(coords);
      });

      source.setData({ type: 'FeatureCollection', features: [...lineFeatures, ...pointFeatures] });
      if (lineFeatures.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(graphBounds, { padding: 40, maxZoom: 18 });
      }
    }, [graph]);

    return (
      <div className="relative w-full h-full">
        <div ref={containerRef} className="w-full h-full" />
        {warningMessage && (
          <div className="absolute top-4 left-1/2 z-10 w-max -translate-x-1/2 rounded-lg border bg-background/80 p-2 text-sm shadow-lg backdrop-blur-sm select-none">
            {warningMessage}
          </div>
        )}
      </div>
    );
  },
);

export default PlanPreview;
