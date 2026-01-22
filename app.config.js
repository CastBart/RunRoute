import 'dotenv/config';

export default {
  expo: {
    name: "RunRoute",
    slug: "runroute",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#007AFF"
    },
    ios: {
      bundleIdentifier: "com.runroute.app",
      supportsTablet: false,
      infoPlist: {
        UIBackgroundModes: ["location"],
        NSLocationAlwaysAndWhenInUseUsageDescription: "RunRoute needs access to your location in the background to track your runs while your screen is locked.",
        NSLocationWhenInUseUsageDescription: "RunRoute needs access to your location to track your runs and show your position on the map."
      }
    },
    android: {
      package: "com.runroute.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#007AFF"
      },
      permissions: [
        "ACCESS_BACKGROUND_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "INTERNET"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "RunRoute needs access to your location to track your runs and show your position on the map.",
          locationAlwaysPermission: "RunRoute needs access to your location in the background to track your runs while the app is not actively in use.",
          locationWhenInUsePermission: "RunRoute needs access to your location to track your runs and show your position on the map.",
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "01d855c1-c436-4fda-adc0-b85bc01ea8c4"
      }
    },
    owner: "castbart",
    privacy: "https://castbart.github.io/runroute-privacy/"
  }
};