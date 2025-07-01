import React, { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { get as getProjection, fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Tile from 'ol/Tile';
import { Coordinate } from 'ol/coordinate';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import { parseTaskPlan } from '../../lib/taskPlanParser';

export interface Snapshot {
  image: string;
  northWest: Coordinate;
  northEast: Coordinate;
  southWest: Coordinate;
  southEast: Coordinate;
  center: Coordinate;
}

export interface PlanPreviewActions {
  takeSnapshot: () => Snapshot | null;
}

function toRoundedLonLat(coords: [number, number]): [number, number] {
  return toLonLat(coords).map(c => Math.round(c * 1000) / 1000) as [number, number];
}

const maxRetries = 3;

function tileLoadFunction(tile: Tile, src: string) {
  const image = tile.getImage() as HTMLImageElement;
  let retries = 0;

  const loadTile = () => {
    image.src = src;

    image.onerror = () => {
      console.warn(`Failed to load tile on ${retries} try`);
      if (retries < maxRetries) {
        retries++;
        setTimeout(() => loadTile, 500 * retries);
      } else {
        console.warn(`Tile failed after ${retries} retries`);
      }
    };

    image.onload = () => {
      image.onerror = null;
    };
  };

  loadTile();
}

const PlanPreview = forwardRef<{ takeSnapshot: () => Snapshot | null }, { xml: string, initialCenter: [number, number] | null }>(({ xml, initialCenter }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource>>(new VectorLayer({
    source: new VectorSource(),
    style: featureStyle,
  }));

  useImperativeHandle(ref, () => ({
    takeSnapshot: () => {
      if (!mapRef.current) return null;
      const map = mapRef.current;
      const view = map.getView();
      const extent = view.calculateExtent(map.getSize());

      const width = Math.round(extent[2] - extent[0]);
      const height = Math.round(extent[3] - extent[1]);

      const northWest = toRoundedLonLat([extent[0], extent[3]]);
      const northEast = toRoundedLonLat([extent[2], extent[3]]);
      const southWest = toRoundedLonLat([extent[0], extent[1]]);
      const southEast = toRoundedLonLat([extent[2], extent[1]]);
      const center = toRoundedLonLat(view.getCenter()!);

      // FIXME this does not destroy the points/lines. need to redraw?
      const source = vectorLayerRef.current.getSource();
      if (source) source.clear();

      const mapCanvas = map.getViewport().querySelector('canvas');
      if (!mapCanvas) return null;

      const compositeCanvas = document.createElement('canvas');
      const context = compositeCanvas.getContext('2d');
      if (!context) return null;

      const dpr = window.devicePixelRatio || 1;

      compositeCanvas.width = mapCanvas.clientWidth;
      compositeCanvas.height = mapCanvas.clientHeight;

      context.drawImage(
        mapCanvas,
        0, 0,
        mapCanvas.clientWidth * dpr,
        mapCanvas.clientHeight * dpr,
        0, 0,
        compositeCanvas.width,
        compositeCanvas.height
      );

      const projection = getProjection('EPSG:3857');
      if (!projection) return null;

      const metersPerUnit = projection.getMetersPerUnit();
      if (!metersPerUnit) return null;

      const gridSize = 10; // meters
      const gridSpacing = gridSize / metersPerUnit;

      context.beginPath();
      context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      context.lineWidth = 2;

      for (let x = extent[0]; x < extent[2]; x += gridSpacing) {
        const pixel = map.getPixelFromCoordinate([x, extent[1]]);
        context.moveTo(pixel[0], 0);
        context.lineTo(pixel[0], compositeCanvas.height);
      }

      for (let y = extent[1]; y < extent[3]; y += gridSpacing) {
        const pixel = map.getPixelFromCoordinate([extent[0], y]);
        context.moveTo(0, pixel[1]);
        context.lineTo(compositeCanvas.width, pixel[1]);
      }

      context.stroke();

      const image = compositeCanvas.toDataURL('image/png');

      return { image, northWest, northEast, southWest, southEast, center, width, height };
    }
  }));

  const graph = useMemo(() => xml ? parseTaskPlan(xml) : undefined, [xml]);
  console.log("graph:", graph);

  // initialize map once
  // 'The final argument passed to useEffect changed size between renders. The order and size of this array must remain constant. Previous: [] Incoming: []'
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !initialCenter) return;

    const base = new TileLayer({
      source: new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attributions: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      }),
    });

    mapRef.current = new Map({
      target: containerRef.current,
      layers: [base, vectorLayerRef.current],
      view: new View({
        center: fromLonLat(initialCenter),
        zoom: 19,
      }),
    });

    return () => {
      mapRef.current?.setTarget(undefined);
      mapRef.current = null;
    };
  }, [initialCenter]);

  // rebuild vector layer whenever graph mutates
  useEffect(() => {
    const source = vectorLayerRef.current.getSource();
    if (!source || !graph) return;
    source.clear();

    const mapEdges = graph.edges.filter(
      (e) => graph.nodes[e.from].geometry && graph.nodes[e.to].geometry,
    );

    // lines + optional point markers
    mapEdges.forEach((e) => {
      const a = graph.nodes[e.from].geometry!;
      const b = graph.nodes[e.to].geometry!;
      const line = new Feature({
        geometry: new LineString([
          fromLonLat([a.lon, a.lat]),
          fromLonLat([b.lon, b.lat]),
        ]),
      });
      line.set('label', e.label);
      source.addFeature(line);
    });

    // add point markers so locations are visible at low zoom
    Object.values(graph.nodes)
      .filter((n) => n.geometry)
      .forEach((n) => {
        const pt = new Feature({
          geometry: new Point(fromLonLat([n.geometry!.lon, n.geometry!.lat])),
        });
        pt.set('marker', true);
        source.addFeature(pt);
      });

    // fit view to features
    if (source.getFeatures().length > 0 && mapRef.current) {
      mapRef.current.getView().fit(source.getExtent(), {
        padding: [40, 40, 40, 40],
        maxZoom: 19,
      });
    }
  }, [graph]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default PlanPreview;

/* STYLING */

function featureStyle(feature: Feature) {
  if (feature.get('marker')) {
    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: 'black' }),
      }),
    });
  }

  const label = feature.get('label') as 'unconditional' | 'true' | 'false';
  let dash: number[] | undefined;
  switch (label) {
    case 'true':
      dash = [10, 10];
      break;
    case 'false':
      dash = [2, 12];
      break;
    default:
      dash = undefined;
  }

  return new Style({
    stroke: new Stroke({
      width: 2,
      lineDash: dash,
    }),
  });
}
