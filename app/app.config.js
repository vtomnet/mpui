import 'dotenv/config';

export default {
  expo: {
    "expo": {
      "name": "test",
      "slug": "test",
      "version": "1.0.0",
      "orientation": "portrait",
      "icon": "./assets/icon.png",
      "userInterfaceStyle": "light",
      "newArchEnabled": true,
      "splash": {
        "image": "./assets/splash-icon.png",
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
      },
      "ios": {
        "supportsTablet": true,
        "bundleIdentifier": "com.anonymous.test"
      },
      "android": {
        "adaptiveIcon": {
          "foregroundImage": "./assets/adaptive-icon.png",
          "backgroundColor": "#ffffff"
        },
        "edgeToEdgeEnabled": true,
        "package": "com.anonymous.test"
      },
      "web": {
        "favicon": "./assets/favicon.png"
      },
      "plugins": [
        "expo-audio"
      ],
      extra: {
        BASE_URL: process.env.BASE_URL,
      }
    }
  }
};
