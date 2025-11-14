import type { Feature, FeatureCollection, LineString, Point } from "geojson";

export interface PlanStep {
  coordinate: [number, number] | null;
  name: string;
  action: string;
  type: "start" | "relative-move" | "gps-move" | "orientation" | "task";
  drawSegment: boolean;
  details?: string;
}

export interface PlanGeometry {
  featureCollection: FeatureCollection<Point | LineString>;
  coordinates: [number, number][];
}

export const ACTION_TAGS = new Set([
  "MoveToTreeID",
  "MoveToGPSLocation",
  "MoveToRelativeLocation",
  "OrientRobotHeading",
  "DetectObject",
  "SampleLeaf",
]);

const EARTH_RADIUS_M = 6_378_137; // WGS-84 mean radius

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;

const normaliseDegrees = (deg: number) => {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

export const almostEqualCoord = (a: [number, number], b: [number, number]) =>
  Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

const toLngLatFromOffsets = (
  position: [number, number],
  northMeters: number,
  eastMeters: number,
): [number, number] => {
  const [lon, lat] = position;
  const latRad = degToRad(lat);
  const dLat = northMeters / EARTH_RADIUS_M;
  const cosLat = Math.cos(latRad);
  const safeCosLat = Math.max(Math.abs(cosLat), 1e-6);
  const dLon = eastMeters / (EARTH_RADIUS_M * safeCosLat);

  return [lon + radToDeg(dLon), lat + radToDeg(dLat)];
};

const moveRelative = (
  position: [number, number],
  orientationDeg: number,
  forwardMeters: number,
  leftMeters: number,
): [number, number] => {
  const orientationRad = degToRad(orientationDeg);
  const northMeters =
    forwardMeters * Math.cos(orientationRad) + leftMeters * Math.sin(orientationRad);
  const eastMeters =
    forwardMeters * Math.sin(orientationRad) - leftMeters * Math.cos(orientationRad);

  return toLngLatFromOffsets(position, northMeters, eastMeters);
};

const traverseNodes = (node: Element, collector: Element[]) => {
  if (ACTION_TAGS.has(node.tagName)) {
    collector.push(node);
    return;
  }

  Array.from(node.children).forEach((child) => traverseNodes(child, collector));
};

export const createEmptyCollection = (): FeatureCollection<Point | LineString> => ({
  type: "FeatureCollection",
  features: [],
});

export const buildPlanGeometry = (
  xml: string,
  origin: [number, number],
): PlanGeometry | null => {
  if (!xml.trim()) {
    return { featureCollection: createEmptyCollection(), coordinates: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length) {
    console.error("Failed to parse mission plan XML");
    return { featureCollection: createEmptyCollection(), coordinates: [] };
  }

  const behaviorTrees = Array.from(doc.getElementsByTagName("BehaviorTree"));
  if (!behaviorTrees.length) {
    return { featureCollection: createEmptyCollection(), coordinates: [] };
  }

  const actionNodes: Element[] = [];
  behaviorTrees.forEach((tree) => {
    Array.from(tree.children).forEach((child) => traverseNodes(child, actionNodes));
  });

  const steps: PlanStep[] = [];
  let currentOrientation = 0; // degrees, 0 = facing north
  let currentCoordinate: [number, number] | null = [...origin];

  steps.push({
    coordinate: currentCoordinate,
    name: "Start",
    action: "Start",
    type: "start",
    drawSegment: false,
  });

  actionNodes.forEach((node) => {
    const tag = node.tagName;
    const stepName = node.getAttribute("name") ?? tag;

    const info: PlanStep = {
      coordinate: currentCoordinate,
      name: stepName,
      action: tag,
      type: "task",
      drawSegment: false,
    };

    if (tag === "MoveToRelativeLocation") {
      const x = Number(node.getAttribute("x"));
      const y = Number(node.getAttribute("y"));
      if (Number.isFinite(x) && Number.isFinite(y) && currentCoordinate) {
        const next = moveRelative(currentCoordinate, currentOrientation, x, y);
        info.coordinate = next;
        info.type = "relative-move";
        info.drawSegment = true;
        info.details = `Relative move: forward ${x.toFixed(1)}m, left ${y.toFixed(1)}m`;
        currentCoordinate = next;
      }
    } else if (tag === "MoveToGPSLocation") {
      const lat = Number(node.getAttribute("latitude"));
      const lon = Number(node.getAttribute("longitude"));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const next: [number, number] = [lon, lat];
        info.coordinate = next;
        info.type = "gps-move";
        info.drawSegment = true;
        info.details = `Move to GPS location (${lat.toFixed(6)}, ${lon.toFixed(6)})`;
        currentCoordinate = next;
      }
    } else if (tag === "OrientRobotHeading") {
      const yaw = Number(node.getAttribute("yaw"));
      const absolute = node.getAttribute("absolute") === "true";
      if (Number.isFinite(yaw)) {
        currentOrientation = absolute ? yaw : currentOrientation + yaw;
        currentOrientation = normaliseDegrees(currentOrientation);
        info.coordinate = currentCoordinate;
        info.type = "orientation";
        info.details = `${absolute ? "Absolute" : "Relative"} heading set to ${currentOrientation.toFixed(1)}°`;
      }
    } else if (ACTION_TAGS.has(tag)) {
      info.coordinate = currentCoordinate;
    }

    steps.push(info);
  });

  const pointFeatures: Feature<Point>[] = [];
  const lineFeatures: Feature<LineString>[] = [];
  const coordinates: [number, number][] = [];

  let segmentOrigin = steps[0]?.coordinate ?? null;

  steps.forEach((step, index) => {
    if (step.coordinate) {
      coordinates.push(step.coordinate);
      pointFeatures.push({
        type: "Feature",
        properties: {
          index: index + 1,
          label: `${index + 1}. ${step.name}`,
          action: step.action,
          type: step.type,
          details: step.details,
        },
        geometry: {
          type: "Point",
          coordinates: step.coordinate,
        },
      });

      if (segmentOrigin && step.drawSegment && !almostEqualCoord(segmentOrigin, step.coordinate)) {
        lineFeatures.push({
          type: "Feature",
          properties: {
            fromStep: index,
            toStep: index + 1,
            label: step.name,
            type: step.type,
          },
          geometry: {
            type: "LineString",
            coordinates: [segmentOrigin, step.coordinate],
          },
        });
      }

      segmentOrigin = step.coordinate;
    }
  });

  if (coordinates.length > 1) {
    lineFeatures.unshift({
      type: "Feature",
      properties: {
        label: "Path",
        type: "path",
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    });
  }

  return {
    featureCollection: {
      type: "FeatureCollection",
      features: [...lineFeatures, ...pointFeatures],
    },
    coordinates,
  };
};
