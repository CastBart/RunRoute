# RunRoute - Project Plan

## Project Overview

**RunRoute** is a cross-platform mobile application built with React Native and Expo that helps runners:
- Plan custom running routes based on target distance
- Track runs in real-time with GPS
- View run history and performance analytics
- Share runs socially with friends and the running community

**Target Platforms:** iOS, Android, Web (limited)
**Primary Tech Stack:** React Native, Expo, Supabase, Google Maps API

---

## Current Implementation Status

### ✅ What's Been Completed

1. **Project Setup & Foundation**
   - ✅ React Native with Expo initialized
   - ✅ Project structure created
   - ✅ Core dependencies installed
   - ✅ Navigation structure (Auth + Main Tabs)
   - ✅ TypeScript configuration
   - ✅ Environment variables setup (.env.example)

2. **Authentication System**
   - ✅ Login screen with email/password
   - ✅ Registration screen with validation
   - ✅ Forgot password functionality
   - ✅ Supabase Auth integration
   - ✅ Session persistence with AsyncStorage
   - ✅ Auth state management with Zustand
   - ✅ Protected route navigation

3. **Route Planning Feature** (MOST ADVANCED)
   - ✅ Interactive map with Google Maps
   - ✅ Start/end point selection
   - ✅ Target distance input (0.5-100 km)
   - ✅ Loop vs. point-to-point routes
   - ✅ Advanced route generation algorithm
   - ✅ Automatic waypoint generation for loops
   - ✅ Route polyline display
   - ✅ Distance & duration estimates
   - ✅ Route regeneration with randomization
   - ✅ Location services integration
   - ✅ Route state management with Zustand

4. **UI Components**
   - ✅ Custom Button component
   - ✅ Custom Input component
   - ✅ Navigation setup (Stack + Tabs)

### ⚠️ Partially Implemented (Placeholder Screens Only)

- ⬜ Run Tracking Screen (placeholder UI, no GPS tracking)
- ⬜ Run History Screen (placeholder UI, no data)
- ⬜ Social Feed Screen (placeholder UI, no posts)
- ⬜ Profile Screen (placeholder UI, no profile data)

### ⬜ Not Yet Implemented

- ⬜ Live GPS run tracking
- ⬜ Run data persistence
- ⬜ Run history and analytics
- ⬜ Social features (posts, likes, comments)
- ⬜ User profiles and settings
- ⬜ Database schema setup in Supabase
- ⬜ API endpoints beyond auth
- ⬜ Image uploads
- ⬜ Push notifications
- ⬜ Background location tracking

---

## Technology Stack - Spec vs. Actual

| Component | Specification | Current Implementation | Action Required |
|-----------|--------------|------------------------|-----------------|
| Framework | React Native + Expo | ✅ React Native + Expo | None |
| State Management | Redux Toolkit + RTK Query | ⚠️ Zustand + React Query | Consider migration or keep Zustand |
| Navigation | React Navigation v6 | ✅ React Navigation v7 | None (newer version) |
| Maps | react-native-maps | ✅ react-native-maps | None |
| Location | expo-location | ✅ expo-location | None |
| Database | Supabase PostgreSQL | ✅ Supabase client setup | Schema needs creation |
| Auth | Supabase Auth | ✅ Implemented | None |
| Storage | AsyncStorage | ✅ AsyncStorage | None |

**Note on State Management:** The specification documents call for Redux Toolkit, but the current implementation uses Zustand + React Query, which is a modern, lightweight alternative with ~90% less boilerplate. Decision needed: migrate to Redux (as per spec) or continue with Zustand (simpler, modern approach).

---

## Development Roadmap

### Phase 1: Project Setup & Foundation ✅ COMPLETED

- [x] Initialize React Native project with Expo
- [x] Set up project structure (components, screens, services, etc.)
- [x] Install core dependencies
- [x] Configure navigation (Stack + Tab navigators)
- [x] Set up environment variables
- [x] Configure TypeScript
- [x] Set up Supabase client

**Status:** Complete

---

### Phase 2: Authentication ✅ COMPLETED

- [x] Create auth screens (Login, Sign Up, Forgot Password)
- [x] Implement Supabase Auth integration
- [x] Set up auth service layer
- [x] Implement session management
- [x] Create auth state store (Zustand)
- [x] Set up protected route navigation
- [x] Add form validation
- [x] Persist auth state with AsyncStorage

**Status:** Complete and functional

---

### Phase 3: Route Planning ✅ COMPLETED

- [x] Integrate Google Maps SDK
- [x] Implement map view with current location
- [x] Create start/end point selection UI
- [x] Add distance input slider
- [x] Implement loop vs. point-to-point toggle
- [x] Integrate Google Directions API
- [x] Build advanced route generation algorithm
- [x] Implement waypoint generation for loop routes
- [x] Display route polyline on map
- [x] Calculate and display distance/duration
- [x] Add route regeneration feature
- [x] Create route state management (Zustand)
- [x] Implement location services
- [x] Add error handling for route generation

**Status:** Complete with advanced features

---

### Phase 4: Database Schema Setup ⬜ TODO

**Priority:** HIGH - Required for all data persistence

#### Tasks:
- [ ] Access Supabase dashboard
- [ ] Enable required PostgreSQL extensions (uuid-ossp, postgis)
- [ ] Create `users` table with profile fields
- [ ] Create `planned_routes` table
- [ ] Create `runs` table
- [ ] Create `run_posts` table (social)
- [ ] Create `post_likes` table
- [ ] Create `post_comments` table
- [ ] Create `user_follows` table (social connections)
- [ ] Create `app_config` table
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create database indexes for performance
- [ ] Create database functions (update_user_stats, update_post_counts)
- [ ] Create database triggers (auto-update timestamps, engagement counts)
- [ ] Test all RLS policies
- [ ] Create sample data for testing

**Reference:** `spec/3. Database Schema Document/runroute_database_schema.md`

---

### Phase 5: Live Run Tracking ⬜ TODO

**Priority:** HIGH - Core feature

#### Tasks:
- [ ] Replace placeholder RunTrackerScreen with live tracking
- [ ] Request GPS permissions (foreground + background)
- [ ] Implement GPS tracking with expo-location
- [ ] Set up background location tracking
- [ ] Create tracking state store
- [ ] Build real-time metrics calculation:
  - [ ] Distance calculation (Haversine formula)
  - [ ] Duration tracking with pause support
  - [ ] Current pace calculation
  - [ ] Average pace calculation
  - [ ] Elevation gain tracking
- [ ] Implement GPS trail polyline display
- [ ] Add pause/resume functionality
- [ ] Add stop run confirmation
- [ ] Create run summary screen
- [ ] Implement run data saving to database
- [ ] Add location accuracy monitoring
- [ ] Handle GPS signal loss gracefully
- [ ] Optimize battery usage during tracking
- [ ] Add audio cues for milestones (optional)
- [ ] Test background tracking on both iOS and Android

**Reference Files:**
- Current placeholder: `src/screens/track/RunTrackerScreen.tsx`
- Tracking store spec: `spec/6. State Managment Docs/runroute_redux_state_management v6.md`

---

### Phase 6: Run History & Analytics ⬜ TODO

**Priority:** MEDIUM - Important for user retention

#### Tasks:
- [ ] Replace placeholder RunHistoryScreen with data-driven list
- [ ] Create run history API service
- [ ] Implement infinite scroll/pagination
- [ ] Build run list item component with summary
- [ ] Create detailed run view screen
- [ ] Display run route on map
- [ ] Show run statistics (pace chart, elevation profile)
- [ ] Implement run filtering (by date, distance)
- [ ] Add search functionality
- [ ] Create run edit/delete functionality
- [ ] Build user statistics dashboard
- [ ] Create charts for:
  - [ ] Weekly/monthly distance
  - [ ] Pace trends over time
  - [ ] Elevation totals
- [ ] Add personal records tracking (fastest pace, longest run)
- [ ] Implement data export (CSV/GPX format)

**Reference Files:**
- Current placeholder: `src/screens/history/RunHistoryScreen.tsx`
- API spec: `spec/4. API Specification Document/runroute_api_specification.md`

---

### Phase 7: Social Features ⬜ TODO

**Priority:** MEDIUM - Differentiator feature

#### Sub-Phase 7.1: Social Feed
- [ ] Replace placeholder SocialFeedScreen
- [ ] Create social feed API service
- [ ] Implement post list with infinite scroll
- [ ] Build run post card component
- [ ] Display run map thumbnail
- [ ] Show run statistics on posts
- [ ] Add pull-to-refresh
- [ ] Implement real-time updates (Supabase Realtime)
- [ ] Add loading states and skeletons

#### Sub-Phase 7.2: Post Interactions
- [ ] Implement like/unlike functionality
- [ ] Add optimistic UI updates for likes
- [ ] Create comment system
- [ ] Build comment input component
- [ ] Show comment list with nested replies
- [ ] Add post sharing (native share)
- [ ] Implement double-tap to like

#### Sub-Phase 7.3: Post Creation
- [ ] Create post creation modal
- [ ] Link run selection
- [ ] Add caption input
- [ ] Implement image upload (optional)
- [ ] Add post visibility toggle (public/private)
- [ ] Show post preview before publishing

#### Sub-Phase 7.4: User Connections
- [ ] Implement follow/unfollow functionality
- [ ] Create user search
- [ ] Build followers/following lists
- [ ] Add friend suggestions
- [ ] Create user profile view (other users)

**Reference Files:**
- Current placeholder: `src/screens/social/SocialFeedScreen.tsx`
- User flows: `spec/5. User Flow & Wireframe Docs/runroute_user_flows_wireframes.md`

---

### Phase 8: Profile & Settings ⬜ TODO

**Priority:** MEDIUM

#### Tasks:
- [ ] Replace placeholder ProfileScreen
- [ ] Display user profile information
- [ ] Show user statistics summary
- [ ] List recent runs
- [ ] Create profile edit screen:
  - [ ] Name, username, bio editing
  - [ ] Avatar upload
  - [ ] Units preference (metric/imperial)
- [ ] Build settings screen:
  - [ ] Privacy settings
  - [ ] Location privacy options
  - [ ] Notification preferences
  - [ ] Theme selection (light/dark/auto)
- [ ] Implement account management:
  - [ ] Change password
  - [ ] Email verification
  - [ ] Account deletion
- [ ] Add logout functionality

**Reference Files:**
- Current placeholder: `src/screens/profile/ProfileScreen.tsx`

---

### Phase 9: Advanced Features & Polish ⬜ TODO

**Priority:** LOW - Post-MVP

#### Route Enhancements
- [ ] Save planned routes
- [ ] Route library/favorites
- [ ] Share routes with other users
- [ ] Route recommendations based on distance/location
- [ ] Elevation profile preview
- [ ] Weather integration

#### Tracking Enhancements
- [ ] Audio coaching (pace alerts)
- [ ] Interval training mode
- [ ] Race mode with virtual pacing
- [ ] Apple Health / Google Fit integration
- [ ] Smartwatch companion app

#### Social Enhancements
- [ ] Activity feed on home screen
- [ ] Achievements/badges system
- [ ] Challenges with friends
- [ ] Leaderboards
- [ ] Running groups/clubs

#### Technical Improvements
- [ ] Offline mode for GPS tracking
- [ ] Route caching for offline use
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Internationalization (i18n)
- [ ] Analytics integration
- [ ] Crash reporting setup

---

### Phase 10: State Management Migration (OPTIONAL) ⬜ DECISION NEEDED

**Current Status:** Using Zustand + React Query (modern, lightweight)
**Spec Requirement:** Redux Toolkit + RTK Query

#### If Migration Decided:
- [ ] Install Redux Toolkit and RTK Query
- [ ] Create Redux store configuration
- [ ] Migrate auth store from Zustand to Redux slice
- [ ] Migrate route store from Zustand to Redux slice
- [ ] Migrate tracking store from Zustand to Redux slice
- [ ] Set up RTK Query API endpoints
- [ ] Update all components using stores
- [ ] Migrate persistence from Zustand persist to Redux Persist
- [ ] Test all state management functionality
- [ ] Remove Zustand dependencies

**Recommendation:** Keep Zustand + React Query. It's simpler, has less boilerplate, excellent TypeScript support, and is widely adopted. Migration would add significant complexity without clear benefits.

---

## Critical Issues & Action Items

### 🔴 High Priority

1. **Google Maps API Key Security**
   - **Issue:** API key is hardcoded in `app.json`
   - **Action:** Move to environment variables and regenerate key
   - **File:** `app.json` line with `googleMapsApiKey`

2. **Database Schema Creation**
   - **Issue:** Database tables don't exist yet
   - **Action:** Execute SQL scripts in Supabase dashboard
   - **Blocking:** Run tracking, history, and social features

3. **API Endpoints**
   - **Issue:** Only auth endpoints work currently
   - **Action:** Implement RPC functions and queries as per API spec
   - **Reference:** `spec/4. API Specification Document/runroute_api_specification.md`

### 🟡 Medium Priority

1. **State Management Decision**
   - **Issue:** Using Zustand instead of spec'd Redux
   - **Action:** Decide to keep Zustand or migrate to Redux
   - **Impact:** Low if staying with Zustand, high effort if migrating

2. **Type Definitions**
   - **Issue:** Types defined but may need sync with actual DB schema
   - **Action:** Review and update `src/types/index.ts` after DB creation

3. **Error Handling**
   - **Issue:** Basic error handling exists but not comprehensive
   - **Action:** Add proper error boundaries and user-friendly messages

### 🟢 Low Priority

1. **Testing**
   - **Issue:** No tests written yet
   - **Action:** Add unit tests for utilities and integration tests for flows

2. **Documentation**
   - **Issue:** Limited code documentation
   - **Action:** Add JSDoc comments to complex functions

---

## File Structure Overview

```
d:\Projects\RunRoute\
├── .env.example                    # Environment variables template
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── projectplan.md                  # This file
├── rules/
│   └── claude.md                   # Development workflow rules
├── spec/                           # Project specifications
│   ├── 1. Product Requirement Document/
│   ├── 2. Technical Architecture Doc/
│   ├── 3. Database Schema Document/
│   ├── 4. API Specification Document/
│   ├── 5. User Flow & Wireframe Docs/
│   └── 6. State Managment Docs/
└── src/
    ├── components/                 # Reusable UI components
    │   ├── Button.tsx
    │   └── Input.tsx
    ├── constants/                  # App-wide constants
    │   └── index.ts
    ├── navigation/                 # Navigation setup
    │   ├── RootNavigator.tsx
    │   ├── AuthNavigator.tsx
    │   └── MainTabNavigator.tsx
    ├── screens/                    # Screen components
    │   ├── auth/                   # ✅ Complete
    │   ├── plan/                   # ✅ Complete
    │   ├── track/                  # ⬜ Placeholder
    │   ├── history/                # ⬜ Placeholder
    │   ├── social/                 # ⬜ Placeholder
    │   └── profile/                # ⬜ Placeholder
    ├── services/                   # API services
    │   ├── supabase.ts            # ✅ Complete
    │   ├── authService.ts         # ✅ Complete
    │   ├── locationService.ts     # ✅ Complete
    │   └── googleMapsService.ts   # ✅ Complete
    ├── store/                      # State management (Zustand)
    │   ├── authStore.ts           # ✅ Complete
    │   └── routeStore.ts          # ✅ Complete
    └── types/                      # TypeScript definitions
        └── index.ts               # ✅ Complete
```

---

## Next Recommended Steps

Based on the current state and priorities:

### Immediate Next Steps (Week 1-2):

1. **Set Up Database Schema**
   - Execute SQL from database schema doc in Supabase
   - Test all tables and RLS policies
   - Insert sample data for testing

2. **Fix Security Issue**
   - Regenerate Google Maps API key
   - Move to environment variables
   - Update app.json to read from env

3. **Implement Live Run Tracking**
   - This is the highest-value incomplete feature
   - Start with basic GPS tracking
   - Add pause/resume functionality
   - Implement run saving

### Short Term (Week 3-4):

4. **Build Run History**
   - Display saved runs
   - Show run details with map
   - Add basic filtering

5. **Create User Profile**
   - Display user stats
   - Allow profile editing
   - Add settings

### Medium Term (Week 5-8):

6. **Implement Social Features**
   - Post creation from runs
   - Social feed display
   - Like/comment functionality
   - Follow system

### Long Term (Week 9+):

7. **Polish & Advanced Features**
   - Performance optimization
   - Advanced analytics
   - Additional social features
   - App store preparation

---

## Development Workflow (Per rules/claude.md)

Following the standard workflow from `rules/claude.md`:

1. ✅ **Plan** - Read codebase, write plan (THIS DOCUMENT)
2. ⬜ **Verify** - Review plan with you before proceeding
3. ⬜ **Execute** - Work on tasks, marking complete as we go
4. ⬜ **Simplify** - Keep changes simple, minimal impact
5. ⬜ **Explain** - High-level explanations of changes
6. ⬜ **Review** - Add summary at the end

**Key Principles:**
- Make every change as simple as possible
- Avoid massive or complex changes
- Minimize code impact
- Everything is about simplicity

---

## Review Section

*This section will be populated as we complete tasks*

### Changes Made:
- (To be filled in as work progresses)

### Lessons Learned:
- (To be filled in as work progresses)

### Outstanding Issues:
- (To be filled in as work progresses)

### Next Priorities:
- (To be filled in as work progresses)

---

## Notes

### Strengths of Current Implementation:
- Very clean TypeScript codebase
- Advanced route planning algorithm with sophisticated loop generation
- Modern state management with Zustand (lighter than Redux)
- Good separation of concerns
- Comprehensive type definitions

### Areas Requiring Attention:
- Database needs to be set up
- Core features (tracking, history, social) are placeholders
- API key security issue
- State management strategy decision (Zustand vs Redux)
- Testing infrastructure needs to be added

### Technical Debt:
- No automated tests
- Limited error handling
- No analytics/monitoring
- No offline support
- Limited accessibility features

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Ready for development
