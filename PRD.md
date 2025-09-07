# QLD Parcel GIS Explorer - Product Requirements Document

A streamlined GIS tool that resolves Queensland Lot/Plan parcels and intersects them with configurable ArcGIS layers for spatial analysis and export.

**Experience Qualities**:
1. **Professional** - Clean, GIS-focused interface that inspires confidence in data accuracy
2. **Efficient** - Streamlined workflow from parcel input to export with minimal clicks
3. **Intuitive** - Self-explanatory controls that don't require GIS expertise to operate

**Complexity Level**: Light Application (multiple features with basic state)
- Multiple coordinated panels with persistent settings and preview functionality

## Essential Features

### Parcel Input & Resolution
- **Functionality**: Parse and normalize various Lot/Plan formats (2/RP53435, L2 RP53435, 2-4 RP53435)
- **Purpose**: Flexible input handling for common Queensland cadastral formats
- **Trigger**: User types in search field
- **Progression**: Input → Parse/normalize preview → Resolve button → Parcel geometry display
- **Success criteria**: All common formats parse correctly and display geometry on map

### Layer Selection & Configuration
- **Functionality**: Checkbox-based layer picker with configurable intersections
- **Purpose**: Allow users to select which GIS layers to intersect with their parcel
- **Trigger**: User checks/unchecks layer options
- **Progression**: Select layers → Configure options → Preview → Export
- **Success criteria**: Layer selections persist and update preview correctly

### Interactive Map Preview
- **Functionality**: Display parcel boundary and intersected features with legend
- **Purpose**: Visual validation of spatial relationships before export
- **Trigger**: After parcel resolution and layer selection
- **Progression**: Parcel display → Layer overlay → Interactive legend → Feature highlighting
- **Success criteria**: Map clearly shows all spatial relationships with proper styling

### Export Generation
- **Functionality**: Generate KML/GeoJSON exports with configurable options
- **Purpose**: Provide usable output for other GIS software
- **Trigger**: Export button click
- **Progression**: Configure export options → Generate file → Download
- **Success criteria**: Files download and open correctly in GIS applications

## Edge Case Handling
- **Invalid parcel formats**: Show format examples and suggestions
- **Network failures**: Graceful degradation with retry options
- **Empty intersections**: Clear messaging about no spatial overlap
- **Large datasets**: Progress indicators and result limiting
- **Unsupported formats**: Clear format requirements and examples

## Design Direction
The design should feel professional and trustworthy like established GIS software, with clean technical aesthetics that communicate precision and reliability - minimal interface with purposeful information density.

## Color Selection
Complementary (opposite colors) - Blue primary for trust/reliability with orange accents for actions, creating clear visual hierarchy between data display and interactive elements.

- **Primary Color**: Deep Blue (oklch(0.45 0.15 240)) - Communications reliability and technical precision
- **Secondary Colors**: Light Blue (oklch(0.85 0.08 240)) for backgrounds, Gray (oklch(0.65 0.02 240)) for supporting elements
- **Accent Color**: Warm Orange (oklch(0.65 0.15 45)) - Attention-grabbing for CTAs and active states
- **Foreground/Background Pairings**: 
  - Background (Light Gray oklch(0.97 0.01 240)): Dark Blue text (oklch(0.25 0.08 240)) - Ratio 8.2:1 ✓
  - Primary (Deep Blue oklch(0.45 0.15 240)): White text (oklch(1 0 0)) - Ratio 5.8:1 ✓
  - Accent (Warm Orange oklch(0.65 0.15 45)): White text (oklch(1 0 0)) - Ratio 4.1:1 ✓
  - Card (White oklch(1 0 0)): Dark Blue text (oklch(0.25 0.08 240)) - Ratio 10.3:1 ✓

## Font Selection
Technical precision requires clean, highly legible sans-serif typography that maintains readability at small sizes for data tables - Inter for its excellent readability and numeric clarity.

- **Typographic Hierarchy**: 
  - H1 (App Title): Inter Bold/24px/tight letter spacing
  - H2 (Panel Headers): Inter SemiBold/18px/normal spacing
  - Body (Interface): Inter Regular/14px/relaxed line height
  - Data (Tables/Coordinates): Inter Regular/13px/tabular numbers
  - Labels: Inter Medium/12px/uppercase tracking

## Animations
Subtle functional animations that communicate data relationships and system status without distracting from technical work - focus on state transitions and loading feedback.

- **Purposeful Meaning**: Motion reinforces spatial relationships and data flow between panels
- **Hierarchy of Movement**: Map interactions and panel transitions get priority over decorative effects

## Component Selection
- **Components**: Cards for panel organization, Tables for feature data, Buttons for actions, Inputs with validation, Select dropdowns for options, Checkbox groups for layers
- **Customizations**: Map component integration, data table with GIS-specific formatting, coordinate input validation
- **States**: Clear loading states for network operations, disabled states during processing, success/error feedback
- **Icon Selection**: Map pin for parcels, layers icon for selections, download for export, settings gear for options
- **Spacing**: Consistent 4px base unit, generous padding in panels (16-24px), tight spacing in data tables (8-12px)
- **Mobile**: Collapsible panels with drawer pattern, simplified map controls, touch-friendly table interaction