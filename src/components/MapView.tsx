import { useRef, useState, useEffect, useImperativeHandle, PropsWithChildren, forwardRef } from "react";
import { Map as LibreMap, MapMouseEvent, LngLat, LngLatBounds, GeoJSONSource } from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { MapContext } from "../context/MapContext";

export interface MapActions {
  panTo: (lonLat: [number, number]) => void;
}

interface Props {
  initialCenter: [number, number] | null;
  realtimeHighlighting: boolean;
  showCachedPolygons: boolean;
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

const MapView = forwardRef<MapActions, PropsWithChildren<Props>>(({
  children, initialCenter, realtimeHighlighting, showCachedPolygons
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LibreMap | null>(null);
    const highlightIdRef = useRef<string | null>(null);
    const [warningMessage, setWarningMessage] = useState('');
    const [isMapReady, setMapReady] = useState(false);
    const fetchingRef = useRef(false);
    const cachedFeaturesRef = useRef<Map<string, Feature<Polygon>>>(new Map());
    const cachedExtentRef = useRef<LngLatBounds | null>(null);
    const throttle = useRafThrottle();
    const onPointerMoveHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null);

    // Expose map actions like panTo via the component's ref
    useImperativeHandle(ref, () => ({
      panTo(lonLat) {
        mapRef.current?.flyTo({ center: lonLat, zoom: 17 });
      },
    }));

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
        return aSw.lng <= bNe.lng && aNe.lng >= bSw.lng && aSw.lat <= bNe.lat && aNe.lat >= bSw.lat;
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
        if (!map || highlightIdRef.current === strId) return;

        const setFeatureState = () => {
            if (highlightIdRef.current) {
                map?.setFeatureState({ source: "farmland", id: highlightIdRef.current }, { highlighted: false });
            }
            if (strId) {
                map?.setFeatureState({ source: "farmland", id: strId }, { highlighted: true });
            }
            highlightIdRef.current = strId;
        }

        if (map.isStyleLoaded()) {
            setFeatureState();
        } else {
            const interval = setInterval(() => {
                if (map.isStyleLoaded()) {
                    setFeatureState();
                    clearInterval(interval);
                }
            }, 50);
        }
    };

    // Main effect for map initialization
    useEffect(() => {
      if (!containerRef.current || mapRef.current || !initialCenter) return;

      const map = new LibreMap({
        container: containerRef.current,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri' },
            labels: { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri' },
            farmland: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'OBJECTID' },
            'cached-polygons-debug': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            // The 'graph' source is for the plan path, which will be managed by the PlanPath component
            graph: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          },
          layers: [
            { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 22 },
            { id: 'labels', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 22 },
            { id: 'cached-polygons-debug-outline', type: 'line', source: 'cached-polygons-debug', paint: { 'line-color': 'red', 'line-width': 1 }, layout: { visibility: 'none' } },
            { id: 'farmland-outline', type: 'line', source: 'farmland', paint: { 'line-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], 'rgba(255,255,0,0.7)', 'rgba(0,0,0,0)'], 'line-width': 3 } },
            // Layers for the plan path
            { id: 'graph-lines', type: 'line', source: 'graph', filter: ['==', '$type', 'LineString'], paint: { 'line-width': 3, 'line-color': '#33ff33', 'line-dasharray': [2, 2] } },
            { id: 'graph-points', type: 'circle', source: 'graph', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#33ff33', 'circle-stroke-color': 'black', 'circle-stroke-width': 1 } }
          ],
        },
        center: initialCenter,
        zoom: 18,
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
                console.log("Fetched crop mapping data");
                const json = await res.json();
                if (json.features?.length) {
                    json.features.forEach((f: Feature<Polygon>) => {
                        const id = f.properties?.OBJECTID;
                        if (id && !cachedFeaturesRef.current.has(id.toString())) {
                            if (cachedFeaturesRef.current.size >= 2048) {
                                const oldestKey = cachedFeaturesRef.current.keys().next().value;
                                if (oldestKey) cachedFeaturesRef.current.delete(oldestKey);
                            }
                            f.id = id; // promoteId needs top-level id
                            cachedFeaturesRef.current.set(id.toString(), f);
                            added = true;
                        }
                    });
                    if (added) {
                        const collection = { type: 'FeatureCollection', features: Array.from(cachedFeaturesRef.current.values()) } as GeoJSON.GeoJSON;
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
        } finally {
            fetchingRef.current = false;
        }
        return added;
      };

      onPointerMoveHandlerRef.current = (e: MapMouseEvent) => {
        const bounds = map.getBounds();
        const width = bounds.getEast() - bounds.getWest();
        const ZOOM_OUT_THRESHOLD = 0.04; // degrees longitude
        throttle(() => {
            if (width <= ZOOM_OUT_THRESHOLD) {
                const best = selectBestFeature(cachedFeaturesRef.current.values(), bounds);
                setHighlightedId(best?.properties?.OBJECTID ?? null);
            } else {
                setHighlightedId(null);
            }
        });
      };

      const onMoveEnd = async () => {
        const bounds = map.getBounds();
        const width = bounds.getEast() - bounds.getWest();
        const ZOOM_OUT_THRESHOLD = 0.04;

        if (width <= ZOOM_OUT_THRESHOLD) {
            let cacheMiss = !cachedExtentRef.current?.contains(bounds.getCenter());
            if (!cacheMiss) {
                // Deeper check if center is covered but maybe not the specific field
                let found = false;
                for (const feature of cachedFeaturesRef.current.values()) {
                    const fBounds = getGeoJSONFeatureBounds(feature);
                    if (fBounds && fBounds.contains(bounds.getCenter())) {
                        found = true;
                        break;
                    }
                }
                if(!found) cacheMiss = true;
            }

            if (cacheMiss) {
                console.log("CACHE MISS");
                await fetchAndCache(bounds);
            }

            const best = selectBestFeature(cachedFeaturesRef.current.values(), bounds);
            if (best) {
                setWarningMessage("");
                setHighlightedId(best.properties?.OBJECTID ?? null);
            } else {
                setWarningMessage("These aren't the fields you're looking for");
                setHighlightedId(null);
            }
        } else {
            setWarningMessage("Zoom in to see farmland regions");
            setHighlightedId(null);
        }
      };

      map.on('load', () => {
        setMapReady(true);
        map.on('moveend', onMoveEnd);
        map.on('movestart', () => setWarningMessage(""));
        onMoveEnd();
      });

      return () => {
        map.remove();
        mapRef.current = null;
        setMapReady(false);
      };
    }, [initialCenter]);

    // Effect for toggling realtime highlighting
    useEffect(() => {
      const map = mapRef.current;
      const handler = onPointerMoveHandlerRef.current;
      if (!map || !handler || !isMapReady) return;

      if (realtimeHighlighting) {
        map.on('move', handler);
        return () => { map.off('move', handler); };
      }
    }, [realtimeHighlighting, isMapReady]);

    // Effect for toggling debug polygons
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded() || !isMapReady) return;
      map.setLayoutProperty(
        'cached-polygons-debug-outline',
        'visibility',
        showCachedPolygons ? 'visible' : 'none'
      );
    }, [showCachedPolygons, isMapReady]);

    return (
      <MapContext.Provider value={{ map: mapRef.current, isMapReady }}>
        <div className="relative w-full h-full">
          <div ref={containerRef} className="w-full h-full" />
          {warningMessage && (
            <div className="absolute top-4 left-1/2 z-10 w-max -translate-x-1/2 rounded-lg border bg-background/80 p-2 text-sm shadow-lg backdrop-blur-sm select-none">
              {warningMessage}
            </div>
          )}
          {/* Child components like PlanPath will be rendered here */}
          {children}
        </div>
      </MapContext.Provider>
    );
  },
);

export default MapView;
