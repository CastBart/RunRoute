# RunRoute - Running Route Planning App

A React Native app that helps runners plan custom routes, track runs, and share with friends.

## Features

- **Route Planning**: Plan routes with custom start/end points, target distance, and loop options
- **Live GPS Tracking**: Track your runs in real-time with pace, distance, and duration metrics
- **Run History**: View and analyze your past runs
- **Social Feed**: Share runs and connect with friends
- **Cloud Sync**: All data saved to the cloud via Supabase

## Tech Stack

- **Frontend**: React Native (Expo)
- **Navigation**: React Navigation
- **State Management**: Zustand + React Query
- **Database & Auth**: Supabase
- **Maps**: Google Maps / react-native-maps
- **Location Tracking**: Expo Location

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

1. Clone the repository
```bash
cd RunRoute
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

5. Update `app.json` with your Google Maps API key:
```json
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_API_KEY_HERE"
  }
},
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_API_KEY_HERE"
    }
  }
}
```

### Running the App

Start the development server:
```bash
npm start
```

Run on iOS:
```bash
npm run ios
```

Run on Android:
```bash
npm run android
```

Run on Web:
```bash
npm run web
```

## Project Structure

```
RunRoute/
├── src/
│   ├── screens/          # Screen components
│   │   ├── auth/         # Authentication screens
│   │   ├── plan/         # Route planning screens
│   │   ├── track/        # Run tracking screens
│   │   ├── history/      # Run history screens
│   │   ├── social/       # Social feed screens
│   │   └── profile/      # Profile screens
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Navigation configuration
│   ├── services/         # API services (Supabase, Google Maps)
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── constants/        # App constants and theme
│   └── assets/           # Images, fonts, etc.
├── App.js                # App entry point
├── app.json              # Expo configuration
└── package.json          # Dependencies
```

## Configuration

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to `.env`
3. Run the database migrations (see `docs/database-schema.md`)

### Google Maps API Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the following APIs:
   - Maps SDK for iOS
   - Maps SDK for Android
   - Directions API
   - Places API
3. Create API credentials and add to `.env` and `app.json`

## Development Status

See [projectplan.md](../projectplan.md) for the full development roadmap and progress.

### Phase 1: Project Setup & Foundation ✅
- [x] Initialize React Native project with Expo
- [x] Set up project structure
- [x] Install core dependencies
- [x] Create basic navigation structure

### Phase 2-10: In Progress
See projectplan.md for complete checklist.

## License

MIT

## Contributing

This is currently a personal project, but contributions are welcome!
