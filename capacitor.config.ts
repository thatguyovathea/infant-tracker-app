import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.infanttracker.app",
  appName: "Infant Tracker",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  ios: {
    allowsLinkPreview: false,
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
}

export default config
