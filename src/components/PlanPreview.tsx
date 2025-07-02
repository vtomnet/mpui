import React, { useEffect, useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { get as getProjection, fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
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
import EsriJSON from 'ol/format/EsriJSON';
import { getArea as getExtentArea, getIntersection } from 'ol/extent';

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
  const regionOutlineLayerRef = useRef<VectorLayer<VectorSource>>(new VectorLayer({
    source: new VectorSource(),
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(255, 255, 0, 0.7)',
        width: 3,
      }),
    }),
  }));
  const [warningMessage, setWarningMessage] = useState('');
  const debounceTimerRef = useRef<number | null>(null);

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

    const map = new Map({
      target: containerRef.current,
      layers: [base, regionOutlineLayerRef.current, vectorLayerRef.current],
      view: new View({
        center: fromLonLat(initialCenter),
        zoom: 19,
      }),
    });
    mapRef.current = map;

    map.on('movestart', () => {
      setWarningMessage('');
      regionOutlineLayerRef.current.getSource()?.clear();
    });

    map.on('moveend', () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(async () => {
        console.log("CHECKING FOR POLYGON");
        const view = map.getView();
        const extent = view.calculateExtent(map.getSize());
        const url = new URL('https://utility.arcgis.com/usrsvcs/servers/5e2c0fc60c8741729b9e6852929445a4/rest/services/Planning/i15_Crop_Mapping_2023_Provisional/MapServer/0/query');
        url.search = new URLSearchParams({
          geometry: extent.join(','),
          geometryType: 'esriGeometryEnvelope',
          inSR: '102100',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: 'OBJECTID',
          returnGeometry: 'true',
          where: "SYMB_CLASS NOT IN ('I', 'U', 'UL', 'X')",
          f: 'json',
        }).toString();

        try {
          const res = await fetch(url.toString());
          if (!res.ok) {
            console.error('Failed to query ArcGIS for cropland.', res.status, res.statusText);
            setWarningMessage('');
            return;
          }
          const data = await res.json();
          const regionOutlineSource = regionOutlineLayerRef.current.getSource();
          if (!regionOutlineSource) return;
          regionOutlineSource.clear();

          if (!data.features || data.features.length === 0) {
            setWarningMessage('No cropland data is available for this area.');
            return;
          }

          const esriJsonFormat = new EsriJSON();
          const features = esriJsonFormat.readFeatures(data, {
            featureProjection: map.getView().getProjection(),
          });

          const highlyVisibleFeatures = [];
          const mapExtent = view.calculateExtent(map.getSize());

          for (const feature of features) {
            const geom = feature.getGeometry();
            if (!geom) continue;

            const featureExtent = geom.getExtent();
            const featureExtentArea = getExtentArea(featureExtent);
            if (featureExtentArea === 0) continue;

            const intersectionExtent = getIntersection(mapExtent, featureExtent);
            const intersectionArea = getExtentArea(intersectionExtent);
            const percentageInView = intersectionArea / featureExtentArea;

            if (percentageInView >= 0.8) {
              highlyVisibleFeatures.push(feature);
            }
          }
          
          if (highlyVisibleFeatures.length === 1) {
            setWarningMessage('');
            regionOutlineSource.addFeature(highlyVisibleFeatures[0]);
          } else if (highlyVisibleFeatures.length > 1) {
            setWarningMessage('Ambiguous region. Please zoom in.');
            regionOutlineSource.addFeatures(highlyVisibleFeatures);
          } else {
            setWarningMessage('No cropland data is available for this area.');
          }
        } catch (e) {
          console.error('Failed to query ArcGIS for cropland.', e);
          setWarningMessage('');
        }
      }, 500);
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      map.setTarget(undefined);
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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {warningMessage && (
        <div className="absolute top-4 left-1/2 z-10 w-max -translate-x-1/2 rounded-lg border bg-background/80 p-2 text-sm shadow-lg backdrop-blur-sm">
          {warningMessage}
        </div>
      )}
    </div>
  );
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
