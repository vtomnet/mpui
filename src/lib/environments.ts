
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
  urdf?: string;
  packages?: Record<string, string>;
  initialJoints?: Record<string, number>;
}

export const environments: Environment[] = [
  {
    name: "Map (beta)",
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
      model: "gpt-5-mini/high",
      schemaName: "gazebo_minimal",
      geojsonName: "none",
    },
  },
  {
    name: "Google Maps",
    settings: {
      sessionName: true,
      model: true,
      deviceSchema: true,
      sendToDevice: true,
      deviceHost: true,
      geojsonFile: true,
    },
    presets: {
      postXml: false,
      model: "gpt-5-mini/high",
      schemaName: "clearpath_husky",
      geojsonName: "none",
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
      model: "gpt-5-mini/high",
      schemaName: "kinova_gen3_6dof",
    },
    urdf: "/models/kinova_kortex_gen3_6dof/kortex_description/arms/gen3/6dof/urdf/GEN3-6DOF_VISION_URDF_ARM_V01.urdf",
    packages: {
      'kortex_description': '/models/kinova_kortex_gen3_6dof/kortex_description'
    },
    initialJoints: {
      'joint_1': 0,
      'joint_2': 120,
      'joint_3': 135,
      'joint_4': 0,
      'joint_5': -105,
      'joint_6': 90
    }
  },
  {
    name: "Boston Dynamics Spot (beta)",
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
      model: "gpt-5-mini/high",
      schemaName: "bd_spot",
    },
    urdf: "/models/boston_dynamics_spot/spot_sim_description/urdf/spot.urdf",
    packages: {
      'velodyne_description': '/models/boston_dynamics_spot/velodyne_description',
      'spot_sim_description': '/models/boston_dynamics_spot/spot_sim_description'
    },
  },
];
