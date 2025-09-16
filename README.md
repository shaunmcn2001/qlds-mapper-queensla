# QLD Parcel GIS Explorer

A specialized GIS tool for resolving Queensland Lot/Plan parcels and performing spatial intersections with configurable ArcGIS layers. Built as a demonstration of modern web-based GIS workflow tools.

🌐 **Live Demo**: [https://shaunmcn2001.github.io/qlds-mapper-queensla/](https://shaunmcn2001.github.io/qlds-mapper-queensla/) 

## Features

- **Flexible Parcel Input**: Supports various Queensland Lot/Plan formats (2/RP53435, L2 RP53435, 2-4 RP53435, etc.)
- **Range Expansion**: Automatically expands ranges like "2-4 RP53435" into individual parcels
- **Interactive Layer Selection**: Choose from pre-configured spatial layers for intersection analysis
- **Live Map Preview**: Visual representation of parcels and intersected features with proper symbology
- **Configurable Export**: Export results as KML or GeoJSON with customizable processing options
- **Persistent Settings**: Layer selections and preferences are saved between sessions

## Architecture

This is a frontend-focused demonstration application that simulates the workflow of a production GIS system:

- **Frontend**: React + TypeScript with Leaflet for mapping
- **Data Layer**: Mock services simulating ArcGIS REST API responses
- **State Management**: React hooks with persistent storage via Spark KV
- **UI Components**: shadcn/ui for consistent, accessible interface components

## Layer Configuration

The application includes sample layers representing common Queensland spatial datasets:

- **Land Types**: Environmental land classification data
- **Vegetation Management**: Vegetation status and regional ecosystems
- **Flood Mapping**: Defined flood events and risk areas

Each layer includes:
- Configurable field selection and aliases
- Custom styling (colors, opacity, stroke width)
- Popup content ordering and formatting
- Name templates for feature display

## Usage

1. **Enter Parcel**: Input a Lot/Plan identifier in the search field
2. **Select Layers**: Choose which spatial layers to intersect with your parcel
3. **Preview**: Click "Preview Intersections" to see results on the map and in the table
4. **Export**: Configure export options and download as KML or GeoJSON

### Supported Parcel Formats

- `2/RP53435` - Standard lot/plan format
- `L2 RP53435` - With "L" prefix
- `2-4 RP53435` - Range format (expands to lots 2, 3, 4)
- `Lot 2 Sec 3 DP754253` - With section number
- `A/DP397521` - Alpha lot identifier

## Development

This application is built on the Spark template with additional GIS-specific functionality:

```bash
npm install
npm run dev
```

Key dependencies:
- `leaflet` & `react-leaflet` for interactive mapping
- `@phosphor-icons/react` for consistent iconography
- Tailwind CSS for styling with custom GIS-appropriate color scheme

## Deployment

The repository includes a [`render.yaml`](render.yaml) that provisions both the FastAPI backend and a Render Static Site for the Vite frontend.

1. **Build the frontend** – Render runs `npm install && npm run build`, producing the production-ready assets in `dist/`.
2. **Static site** – The static service publishes the `dist/` directory and exposes the frontend at `https://lotplan-frontend.onrender.com` by default.
3. **API base URL** – During the build, the `VITE_API_BASE` environment variable is injected with the backend’s public URL so the frontend calls the deployed API instead of `localhost`.
4. **CORS** – The backend’s `CORS_ORIGINS` includes both `http://localhost:5173` (for local development) and the Render static site origin.

For alternative hosting targets (e.g. GitHub Pages), set the `VITE_BASE_PATH` environment variable before running `npm run build` to control the Vite `base` path.

## Production Considerations

In a production environment, this application would integrate with:

- **Backend API**: FastAPI service handling parcel resolution and ArcGIS queries
- **Spatial Database**: PostGIS or similar for efficient geometry operations
- **Layer Registry**: YAML-based configuration for maintaining layer definitions
- **Authentication**: User management and access control for spatial data
- **Caching**: Redis or similar for frequently accessed spatial queries

The current implementation demonstrates the complete user workflow and interface patterns that would be used with a production backend.
