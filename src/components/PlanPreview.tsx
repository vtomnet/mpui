import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import OlMap, { MapBrowserEvent } from 'ol/Map';
import View from 'ol/View';
import { get as getProjection, fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Coordinate } from 'ol/coordinate';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import { parseTaskPlan } from '../../lib/taskPlanParser';
import EsriJSON from 'ol/format/EsriJSON';
import {
  getArea,
  getCenter,
  getIntersection,
  type Extent,
  createEmpty,
  extend,
  containsExtent,
  intersects,
} from 'ol/extent';

export interface Snapshot {
  image: string;
  northWest: Coordinate;
  northEast: Coordinate;
  southWest: Coordinate;
  southEast: Coordinate;
  center: Coordinate;
  width: number;
  height: number;
}

export interface PlanPreviewActions {
  takeSnapshot: () => Snapshot | null;
  panTo: (lonLat: [number, number]) => void;
}

function toRoundedLonLat(coords: [number, number]): [number, number] {
  return toLonLat(coords).map((c) => Math.round(c * 1000) / 1000) as [number, number];
}

function getDist(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) return null;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
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

const PlanPreview = forwardRef<PlanPreviewActions, { xml: string; initialCenter: [number, number] | null }>(
  ({ xml, initialCenter }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<OlMap | null>(null);

    // The vector layer with all potential outlines.
    const outlineSourceRef = useRef(new VectorSource());
    const highlightedStyle = new Style({
      stroke: new Stroke({ color: 'rgba(255,255,0,0.7)', width: 3 }),
    });
    const highlightIdRef = useRef<string | null>(null);

    const outlineStyleFn = (feature: Feature) =>
      String(feature.get("OBJECTID")) === highlightIdRef.current
        ? highlightedStyle
        : null;

    const outlineLayerRef = useRef(
      new VectorLayer({
        source: outlineSourceRef.current,
        style: outlineStyleFn,
        updateWhileInteracting: true,
        updateWhileAnimating: true,
      }),
    );

    // Layer that holds graph edges + points (static)
    const graphLayerRef = useRef(
      new VectorLayer({
        source: new VectorSource(),
        style: featureStyle,
      }),
    );

    const [warningMessage, setWarningMessage] = useState('');

    const fetchingRef = useRef(false);
    const cachedFeaturesRef = useRef<Map<string, Feature>>(new Map());
    const cachedExtentRef = useRef<Extent | null>(null);

    const throttle = useRafThrottle();

    const graph = useMemo(() => (xml ? parseTaskPlan(xml) : undefined), [xml]);

    const selectBestFeature = (features: Iterable<Feature>, viewExtent: Extent): Feature | null => {
      let best: { feature: Feature; score: number } | null = null;

      const mapCenter = getCenter(viewExtent);
      const mapArea = getArea(viewExtent);
      const maxDist = getDist(mapCenter, viewExtent);
      if (maxDist === null) return null;

      for (const feature of features) {
        const geom = feature.getGeometry();
        if (!geom) continue;
        const fExtent = geom.getExtent();
        if (!intersects(fExtent, viewExtent)) continue;

        const intersection = getIntersection(viewExtent, fExtent);
        const intersectionArea = getArea(intersection);
        const featureArea = getArea(fExtent);
        if (featureArea === 0) continue;

        const [ix1, iy1, ix2, iy2] = intersection;
        const visibleCenter = [(ix1 + ix2) / 2, (iy1 + iy2) / 2];
        const distScore = 1 - (getDist(mapCenter, visibleCenter) ?? 0) / maxDist;
        const coverageScore = intersectionArea / featureArea;
        const viewportScore = intersectionArea / mapArea;

        const score = 0.25 * coverageScore + 0.25 * viewportScore + 0.5 * distScore;
        if (!best || score > best.score) best = { feature, score };
      }
      return best?.feature ?? null;
    };

    const setHighlightedId = (id: string | null) => {
      if (highlightIdRef.current === id) return; // no change
      console.log("setHighlightedId");
      highlightIdRef.current = id;
      outlineLayerRef.current.changed();
    };

    useImperativeHandle(ref, () => ({
      panTo(lonLat) {
        mapRef.current?.getView().animate({ center: fromLonLat(lonLat), zoom: 17, duration: 1000 });
      },
      takeSnapshot() {
        const map = mapRef.current;
        if (!map) return null;
        const view = map.getView();
        const extent = view.calculateExtent(map.getSize());

        const [width, height] = [extent[2] - extent[0], extent[3] - extent[1]].map(Math.round);
        const corner = (x: number, y: number) => toRoundedLonLat([x, y]);
        const [x1, y1, x2, y2] = extent;

        const canvas = map.getViewport().querySelector('canvas');
        if (!canvas) return null;

        const out = document.createElement('canvas');
        out.width = canvas.clientWidth;
        out.height = canvas.clientHeight;
        const ctx = out.getContext('2d');
        if (!ctx) return null;
        const dpr = window.devicePixelRatio || 1;
        ctx.drawImage(canvas, 0, 0, canvas.clientWidth * dpr, canvas.clientHeight * dpr, 0, 0, out.width, out.height);

        return {
          image: out.toDataURL('image/png'),
          northWest: corner(x1, y2),
          northEast: corner(x2, y2),
          southWest: corner(x1, y1),
          southEast: corner(x2, y1),
          center: toRoundedLonLat(view.getCenter() as [number, number]),
          width,
          height,
        };
      },
    }));

    useEffect(() => {
      if (!containerRef.current || mapRef.current || !initialCenter) return;

      const base = new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }),
      });

      const map = new OlMap({
        target: containerRef.current,
        layers: [base, outlineLayerRef.current, graphLayerRef.current],
        view: new View({ center: fromLonLat(initialCenter), zoom: 19 }),
      });
      mapRef.current = map;

      const fetchAndCache = async (extentToFetch: Extent): Promise<boolean> => {
        if (fetchingRef.current) return false;
        fetchingRef.current = true;
        let added = false;

        try {
          const [w, h] = [extentToFetch[2] - extentToFetch[0], extentToFetch[3] - extentToFetch[1]];
          const center = getCenter(extentToFetch);
          const factor = 3;
          const fetchExtent: Extent = [
            center[0] - (w * factor) / 2,
            center[1] - (h * factor) / 2,
            center[0] + (w * factor) / 2,
            center[1] + (h * factor) / 2,
          ];

          const url = new URL(
            'https://utility.arcgis.com/usrsvcs/servers/5e2c0fc60c8741729b9e6852929445a4/rest/services/Planning/i15_Crop_Mapping_2023_Provisional/MapServer/0/query',
          );
          url.search = new URLSearchParams({
            geometry: fetchExtent.join(','),
            geometryType: 'esriGeometryEnvelope',
            inSR: '102100',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: 'OBJECTID',
            returnGeometry: 'true',
            where: "SYMB_CLASS NOT IN ('I', 'U', 'UL', 'X')",
            f: 'json',
          }).toString();

          const res = await fetch(url.toString());
          if (res.ok) {
            const json = await res.json();
            if (json.features?.length) {
              const esri = new EsriJSON();
              const feats = esri.readFeatures(json, { featureProjection: map.getView().getProjection() });
              feats.forEach((f: Feature) => {
                const id = f.get('OBJECTID');
                if (id && !cachedFeaturesRef.current.has(id.toString())) {
                  cachedFeaturesRef.current.set(id.toString(), f);
                  outlineSourceRef.current.addFeature(f); // ⇐ add once, keep forever
                  added = true;
                }
              });
            }
            if (!cachedExtentRef.current) cachedExtentRef.current = createEmpty();
            extend(cachedExtentRef.current, fetchExtent);
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

      const onPointerMove = (evt: MapBrowserEvent<PointerEvent>) => {
        if (!evt.dragging) return;
        throttle(() => {
          const extent = evt.frameState?.extent ?? map.getView().calculateExtent(map.getSize());
          const best = selectBestFeature(cachedFeaturesRef.current.values(), extent);
          setHighlightedId(best ? best.get('OBJECTID')?.toString() ?? null : null);
        });
      };

      const onMoveEnd = async () => {
        const extent = map.getView().calculateExtent(map.getSize());
        const cacheMiss = !cachedExtentRef.current || !containsExtent(cachedExtentRef.current, extent);

        if (cacheMiss) {
          console.log("CACHE MISS");
          await fetchAndCache(extent);
        } else if (
          cachedExtentRef.current &&
          (extent[0] - cachedExtentRef.current[0] < (extent[2] - extent[0]) / 2 ||
            cachedExtentRef.current[2] - extent[2] < (extent[2] - extent[0]) / 2)
        ) {
          // near edge, fire‑and‑forget background fetch
          fetchAndCache(extent);
        }

        const best = selectBestFeature(cachedFeaturesRef.current.values(), extent);
        if (best) {
          setWarningMessage('');
          setHighlightedId(best.get('OBJECTID')?.toString() ?? null);
        } else {
          setWarningMessage("These aren't the fields you're looking for.");
          setHighlightedId(null);
        }
      };

      map.on('pointermove', onPointerMove);
      map.on('moveend', onMoveEnd);
      map.on('movestart', () => setWarningMessage(''));

      return () => {
        map.un('pointermove', onPointerMove);
        map.un('moveend', onMoveEnd);
        map.setTarget(undefined);
        mapRef.current = null;
      };
    }, [initialCenter]);

    useEffect(() => {
      const source = graphLayerRef.current.getSource();
      if (!source) return;
      source.clear();
      if (!graph) return;

      const hasGeometry = (id: string) => Boolean(graph.nodes[id].geometry);

      graph.edges.filter((e) => hasGeometry(e.from) && hasGeometry(e.to)).forEach((e) => {
        const a = graph.nodes[e.from].geometry!;
        const b = graph.nodes[e.to].geometry!;
        const line = new Feature({
          geometry: new LineString([fromLonLat([a.lon, a.lat]), fromLonLat([b.lon, b.lat])]),
        });
        line.set('label', e.label);
        source.addFeature(line);
      });

      Object.values(graph.nodes)
        .filter((n) => n.geometry)
        .forEach((n) => {
          const pt = new Feature({ geometry: new Point(fromLonLat([n.geometry!.lon, n.geometry!.lat])) });
          pt.set('marker', true);
          source.addFeature(pt);
        });

      if (source.getFeatures().length && mapRef.current) {
        mapRef.current.getView().fit(source.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 19 });
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

function featureStyle(feature: Feature) {
  if (feature.get('marker')) {
    return new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({ color: 'black' }) }) });
  }

  const label = feature.get('label') as 'unconditional' | 'true' | 'false';
  const dash = label === 'true' ? [10, 10] : label === 'false' ? [2, 12] : undefined;
  return new Style({ stroke: new Stroke({ width: 2, lineDash: dash }) });
}
