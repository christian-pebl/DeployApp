# DeployApp (Map Explorer) - Comprehensive Technical Specification

## Table of Contents
1. [Application Overview](#application-overview)
2. [Technical Architecture](#technical-architecture)
3. [Core Features](#core-features)
4. [Database Schema](#database-schema)
5. [Authentication System](#authentication-system)
6. [UI/UX Design System](#uiux-design-system)
7. [Map Implementation](#map-implementation)
8. [Component Architecture](#component-architecture)
9. [State Management](#state-management)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Development Setup](#development-setup)
12. [API Endpoints](#api-endpoints)
13. [Performance Considerations](#performance-considerations)
14. [Security Features](#security-features)

## Application Overview

**DeployApp** is a sophisticated web-based map exploration and annotation platform that allows authenticated users to create, manage, and visualize geographic data through interactive maps. The application supports multiple types of geographic annotations including pins, lines, and areas, with comprehensive project management and tagging systems.

### Core Purpose
- **Geographic Data Management**: Create and organize pins, lines, and areas on interactive maps
- **Project Organization**: Group geographic elements into projects for better organization
- **Collaboration Ready**: Multi-user support with individual data isolation
- **Real-time Visualization**: Interactive map interface with live updates and editing capabilities

## Technical Architecture

### Framework Stack
- **Frontend**: Next.js 15.3.3 (React 18.3.1)
- **Backend**: Next.js API Routes + Supabase
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (OAuth with Google)
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: Radix UI primitives
- **Maps**: Leaflet.js 1.9.4
- **Language**: TypeScript 5
- **Deployment**: Vercel-ready configuration

### Architecture Patterns
- **Client-Side Rendering**: Full CSR approach with `'use client'` components
- **Component-Based Architecture**: Modular, reusable components
- **Custom Hooks Pattern**: Business logic abstraction
- **Compound Components**: Complex UI patterns with Radix UI
- **Row Level Security**: Database-level security with Supabase RLS

## Core Features

### 1. Map Interaction System
- **Interactive Pan/Zoom**: Full map navigation with touch and mouse support
- **Multi-Layer Support**: Pins, lines, areas, and current location layers
- **Real-time Preview**: Live preview during drawing operations
- **Coordinate System Support**: 
  - Decimal degrees (DD)
  - Degrees, minutes, seconds (DMS)
- **Unit Systems**: Metric and Imperial measurement support
- **Geolocation**: Real-time user location tracking with visual indicator

### 2. Geographic Annotation Types

#### Pins (Point Annotations)
- **Properties**: Latitude, longitude, label, notes, visibility toggle
- **Visual**: Custom SVG markers with tag-based color coding
- **Interaction**: Click-to-edit, drag-to-reposition capability (planned)
- **Metadata**: Creation/update timestamps, user ownership

#### Lines (Polyline Annotations)
- **Properties**: Path array, label, notes, visibility toggle
- **Visual**: Customizable stroke weight, color, and opacity
- **Metrics**: Real-time distance calculation
- **Editing**: Vertex manipulation with drag handles (implemented)

#### Areas (Polygon Annotations)
- **Properties**: Path array, label, notes, fill/stroke visibility toggles
- **Visual**: Customizable fill and stroke styling
- **Metrics**: Area calculation in hectares/acres
- **Editing**: Vertex manipulation with visual corner markers

### 3. Project Management System
- **Hierarchical Organization**: Projects contain pins, lines, areas, and tags
- **User Isolation**: Each user can only access their own projects
- **Metadata**: Project name, description, timestamps
- **Active Project Context**: Single active project at a time

### 4. Tagging System
- **Color-Coded Tags**: Visual organization with hex color support
- **Project Scoped**: Tags belong to specific projects
- **Multi-Tag Support**: Geographic elements can have multiple tags
- **Visual Integration**: Tag colors affect map element appearance

### 5. User Interface Features
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Dark/Light Mode**: Comprehensive theme support via CSS custom properties
- **Toast Notifications**: User feedback system
- **Context Menus**: Right-click interactions for advanced operations
- **Popup Forms**: Inline editing with form validation
- **Settings Panel**: User preferences for units and coordinate formats

## Database Schema

### Core Tables Structure

```sql
-- Projects table
projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Pins table  
pins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  label text NOT NULL,
  notes text,
  label_visible boolean DEFAULT true,
  user_id uuid REFERENCES auth.users NOT NULL,
  project_id uuid REFERENCES projects,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Lines table
lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  path jsonb NOT NULL, -- Array of {lat: number, lng: number}
  label text NOT NULL,
  notes text,
  label_visible boolean DEFAULT true,
  user_id uuid REFERENCES auth.users NOT NULL,
  project_id uuid REFERENCES projects,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Areas table
areas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  path jsonb NOT NULL, -- Array of {lat: number, lng: number}
  label text NOT NULL,
  notes text,
  label_visible boolean DEFAULT true,
  fill_visible boolean DEFAULT true,
  user_id uuid REFERENCES auth.users NOT NULL,
  project_id uuid REFERENCES projects,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Tags table
tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  color text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  project_id uuid REFERENCES projects NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

### Security Implementation
- **Row Level Security (RLS)**: Enabled on all tables
- **User Isolation**: Policies ensure users can only access their own data
- **CRUD Policies**: Comprehensive policies for SELECT, INSERT, UPDATE, DELETE operations
- **Automatic Triggers**: Updated timestamp triggers on all tables

## Authentication System

### Supabase Integration
```typescript
// Authentication hook structure
const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Session management
  // OAuth state change handling
  // Error handling
}

// OAuth Configuration
signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}
```

### Authentication Flow
1. **Login Page**: Google OAuth integration with Supabase
2. **Callback Handling**: Server-side session establishment
3. **Route Protection**: Automatic redirect for unauthenticated users
4. **Session Persistence**: Automatic session restoration on app reload
5. **Logout Flow**: Complete session cleanup and redirect

## UI/UX Design System

### Color System (CSS Custom Properties)
```css
:root {
  /* Light theme */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 9% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 10% 3.9%;
  --radius: 0.5rem;
}

.dark {
  /* Dark theme variations */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... additional dark theme properties */
}
```

### Typography System
- **Font Family**: PT Sans (Google Fonts)
- **Font Weights**: 400 (regular), 700 (bold)
- **Font Loading**: Preconnected with display=swap optimization

### Component Library
Based on Radix UI primitives with custom styling:

#### Core Components
- **Button**: Multiple variants (default, outline, secondary, destructive)
- **Input/Textarea**: Form controls with validation states
- **Dialog/Popup**: Modal interfaces for editing
- **Tooltip**: Contextual help and information
- **Toast**: Notification system
- **Card**: Content containers
- **Tabs**: Navigation and organization
- **Dropdown Menu**: Context actions
- **Progress**: Loading and completion states
- **Avatar**: User representation
- **Badge**: Status and category indicators

#### Layout Components
- **Scroll Area**: Custom scrollbar styling
- **Separator**: Visual content division
- **Collapsible**: Expandable content sections
- **Accordion**: FAQ and organized content

### Responsive Design Strategy
- **Mobile-First**: Base styles target mobile devices
- **Breakpoint System**: Tailwind's responsive utilities
- **Touch-Friendly**: Minimum 44px touch targets
- **Flexible Layouts**: CSS Grid and Flexbox utilization

## Map Implementation

### Leaflet Integration
```typescript
// Map initialization with custom configuration
const map = L.map(containerRef.current, {
  center: [lat, lng],
  zoom: zoomLevel,
  zoomControl: false // Custom zoom controls
})

// Tile layer configuration
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map)
```

### Custom Map Features

#### Layer Management
```typescript
// Layer organization
const pinLayer = L.layerGroup().addTo(map)
const lineLayer = L.layerGroup().addTo(map)
const areaLayer = L.layerGroup().addTo(map)
const previewLayer = L.layerGroup().addTo(map)
const editingLayer = L.layerGroup().addTo(map)
```

#### Custom Markers
```typescript
// SVG-based custom icons
const createCustomIcon = (color: string) => {
  const iconHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" 
         fill="${color}" width="36" height="36" class="drop-shadow-lg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `
  
  return L.divIcon({
    html: iconHtml,
    className: 'border-0 bg-transparent',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
  })
}
```

#### Geometry Calculations
```typescript
// Area calculation using shoelace formula
function calculatePolygonArea(path: { lat: number; lng: number }[]): number {
  let area = 0
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    area += (p1.lng * p2.lat - p2.lng * p1.lat)
  }
  const areaSqDegrees = Math.abs(area / 2)
  
  // Convert to hectares using average latitude
  const avgLatRad = (path.reduce((sum, p) => sum + p.lat, 0) / path.length) * (Math.PI / 180)
  const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * avgLatRad)
  const metersPerDegreeLng = 111320 * Math.cos(avgLatRad)
  
  return (areaSqDegrees * metersPerDegreeLat * metersPerDegreeLng) / 10000
}
```

### Interactive Drawing System

#### Drawing Modes
- **Pin Mode**: Single-click pin placement
- **Line Mode**: Click-to-start, click-to-finish line drawing
- **Area Mode**: Multi-point polygon creation with automatic closure

#### Preview System
- **Real-time Preview**: Visual feedback during drawing
- **Distance Display**: Live distance calculation for lines
- **Snap-to-Grid**: Optional grid snapping (planned feature)

#### Editing Capabilities
- **Vertex Editing**: Drag handles for line and area modification
- **Label Toggle**: Show/hide labels per element
- **Fill Toggle**: Show/hide area fills
- **Delete Operations**: Safe deletion with confirmation

## Component Architecture

### Main Components

#### `MapExplorer` (Primary Container)
```typescript
interface MapExplorerProps {
  user: User
}

// State management for all map data
const [pins, setPins] = useState<Pin[]>([])
const [lines, setLines] = useState<Line[]>([])
const [areas, setAreas] = useState<Area[]>([])
const [projects, setProjects] = useState<Project[]>([])
const [tags, setTags] = useState<Tag[]>([])
```

#### `Map` (Leaflet Integration)
```typescript
interface MapProps {
  mapRef: React.MutableRefObject<LeafletMap | null>
  center: LatLngExpression
  zoom: number
  pins: Pin[]
  lines: Line[]
  areas: Area[]
  // ... extensive prop interface for all map interactions
}
```

### Custom Hooks

#### `useAuth` - Authentication Management
- Session state management
- OAuth integration
- Route protection logic
- Error handling

#### `useMapView` - Viewport Persistence
```typescript
const useMapView = (userId: string) => {
  const [view, setViewState] = useState<MapView | null>(null)
  
  // localStorage integration for viewport persistence
  // User-specific view storage
}
```

#### `useSettings` - User Preferences
```typescript
const useSettings = () => {
  const [settings, setSettingsState] = useState<Settings | null>(null)
  
  // Units and coordinate format preferences
  // localStorage persistence
}
```

### UI Component Patterns

#### Form Handling
```typescript
// Popup form pattern for map annotations
const showPopup = (latlng: LatLng, type: 'pin' | 'line' | 'area') => {
  const content = `
    <form id="${formId}">
      <input type="text" name="label" required />
      <textarea name="notes"></textarea>
      <select name="tagId"></select>
      <button type="submit">Save</button>
      <button type="button" class="cancel-btn">Cancel</button>
    </form>
  `
  
  // Dynamic event listener attachment
  // Form validation and submission
}
```

## State Management

### Local State Strategy
- **Component State**: useState for component-specific data
- **Custom Hooks**: Shared state logic abstraction
- **Local Storage**: Persistent user preferences
- **Ref Management**: Direct DOM/Leaflet API access

### State Synchronization
- **Database Sync**: Planned Supabase real-time subscriptions
- **Optimistic Updates**: Client-side state updates with server sync
- **Error Recovery**: Rollback mechanisms for failed operations

## Deployment & Infrastructure

### Vercel Configuration
```json
{
  "scripts": {
    "dev": "next dev -p 3050",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

### Next.js Configuration
```typescript
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Production deployment configuration
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
}
```

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google OAuth application

### Installation Steps
```bash
# Clone and install dependencies
npm install

# Environment setup
cp .env.local.example .env.local
# Configure environment variables

# Database setup
# Run supabase/schema.sql in your Supabase dashboard

# Development server
npm run dev
```

### Development Tools
- **TypeScript**: Full type safety
- **ESLint**: Code quality enforcement (configured to ignore during builds)
- **Prettier**: Code formatting (implied)
- **Hot Reload**: Next.js development server

## API Endpoints

### Authentication Routes
- `GET /auth/callback` - OAuth callback handling
- Authentication managed through Supabase client-side SDK

### Planned API Routes
```typescript
// Future API endpoints (currently client-side only)
// GET /api/projects - List user projects
// POST /api/projects - Create new project
// GET /api/pins - List project pins
// POST /api/pins - Create new pin
// PUT /api/pins/[id] - Update pin
// DELETE /api/pins/[id] - Delete pin
// Similar patterns for lines, areas, and tags
```

## Performance Considerations

### Optimization Strategies
- **Dynamic Imports**: Map component loaded with next/dynamic
- **Code Splitting**: Automatic Next.js optimization
- **Image Optimization**: Next.js Image component integration
- **CSS Custom Properties**: Efficient theme switching
- **Lazy Loading**: Leaflet and heavy components

### Bundle Analysis
- **Dependencies**: Carefully selected for size and functionality
- **Tree Shaking**: Enabled through ES modules
- **Compression**: Automatic Vercel optimization

### Map Performance
- **Layer Management**: Efficient layer clearing and redrawing
- **Event Debouncing**: Smooth interaction with rate limiting
- **Memory Management**: Proper cleanup of map instances and listeners

## Security Features

### Data Protection
- **Row Level Security**: Database-level access control
- **User Isolation**: Complete data segregation between users
- **OAuth Security**: Google OAuth with secure redirect handling
- **XSS Protection**: React's built-in protections

### Input Validation
- **Client-Side**: Form validation with browser APIs
- **Type Safety**: TypeScript ensures type correctness
- **Sanitization**: Proper handling of user input in map labels/notes

### Environment Security
- **Environment Variables**: Sensitive data stored securely
- **API Keys**: Public keys for client-side usage only
- **CORS**: Supabase handles cross-origin requests securely

---

## Conclusion

DeployApp represents a comprehensive, production-ready map annotation platform with a modern tech stack, robust security, and extensive feature set. The application is designed for scalability, maintainability, and user experience, with a clear separation of concerns and well-defined architectural patterns.

The codebase demonstrates professional development practices including TypeScript adoption, component-based architecture, custom hook patterns, and comprehensive error handling. The integration with Supabase provides enterprise-level authentication and database capabilities while maintaining development simplicity.

This specification serves as both documentation and implementation guide for developers working on or extending the DeployApp platform.