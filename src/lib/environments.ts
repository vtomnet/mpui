
export interface Environment {
  name: string;
  settings: {
    sessionName: boolean;
    model: boolean;
    deviceSchema: boolean;
    sendToDevice: boolean;
    deviceHost: boolean;
    realtimeHighlighting?: boolean;
    showCachedPolygons?: boolean;
    geojsonFile?: boolean;
    kinova?: boolean;
  };
  presets: {
    realtimeHighlighting?: boolean;
    showCachedPolygons?: boolean;
    postXml?: boolean;
    model?: string;
    schemaName?: string;
    geojsonName?: string;
  };
}

export const environments: Environment[] = [
  {
    name: "Map",
    settings: {
      sessionName: true,
      model: true,
      deviceSchema: true,
      sendToDevice: true,
      deviceHost: true,
      realtimeHighlighting: true,
      showCachedPolygons: true,
      geojsonFile: true,
    },
    presets: {
      realtimeHighlighting: true,
      showCachedPolygons: false,
      postXml: false,
      model: "gemini-2.5-flash",
      schemaName: "gazebo_minimal",
      geojsonName: "None",
    },
  },
  {
    name: "Kinova Kortex Gen3 6DOF",
    settings: {
      sessionName: true,
      model: true,
      deviceSchema: true,
      sendToDevice: true,
      deviceHost: true,
      kinova: true,
    },
    presets: {
      postXml: false,
      model: "gemini-2.5-flash",
      schemaName: "kinova_gen3_6dof",
    },
  },
];
