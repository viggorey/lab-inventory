# BruneiMapApp — Integration Brief for Next.js

This folder contains everything needed to integrate a Brunei field-research map application into a Next.js website. The app was originally built as a standalone local tool (plain HTML + Express). Your job is to rebuild it as a Next.js page/component using the same features, data schema, and visual design described below.

---

## What the app is

An interactive satellite map of Brunei used for field research. Users can:
- View a map of Brunei with satellite imagery + road/label overlays
- See pinned field sites as markers on the map
- Click a marker or sidebar card to view site details (name, description, flora, fauna, photo)
- Add new sites by clicking the map or entering coordinates manually
- Edit and delete existing sites
- Upload a photo per site
- Tag each site with any number of **flora** and **fauna** species (free-text, autocomplete from past entries)
- **Filter the map by species**: type a species name in the sidebar → the map zooms to show only sites containing that species, all others fade out
- Search sites by name in the sidebar

The site data lives in `data/sites.json` in this folder. There are currently 15 real research sites in Brunei.

---

## Stack to use

| Layer | Choice |
|---|---|
| Framework | Next.js (whatever version is already in use) |
| Map | Leaflet via `react-leaflet` — **must be loaded client-side only** (`dynamic` import with `ssr: false`) |
| Map tiles | Esri World Imagery (satellite) + Esri Transportation + Esri Boundaries overlays (all free, no API key) |
| Data storage | `data/sites.json` file, read/written via Next.js API routes |
| Photo storage | `public/photos/` directory, served as static files |
| File upload | `formidable` package in the API route |
| Styling | Tailwind (if already set up) or plain CSS — match the green/blue colour scheme described below |

---

## Data schema

Each site in `sites.json` is an object:

```json
{
  "id": "uuid-string",
  "name": "Saw Mill",
  "lat": 4.559278,
  "lng": 114.489598,
  "description": "Optional free-text description",
  "photo": "filename.jpg",
  "flora": ["Nepenthes bicalcarata", "Nepenthes ampullaria"],
  "fauna": ["Colobopsis schmitzi", "Dinomyrmex gigas"]
}
```

- `photo` is a bare filename (e.g. `"1234567890.jpg"`). The actual file lives at `public/photos/1234567890.jpg`.
- `flora` and `fauna` are arrays of strings; may be empty `[]` or absent.
- `id` is a UUID v4 string generated client-side via `crypto.randomUUID()`.

---

## API routes needed

### `GET /api/sites`
Returns the full `sites.json` array as JSON.

### `POST /api/sites`
Body: the full updated sites array (JSON).  
Writes it to `data/sites.json` (overwrite).

### `POST /api/upload`
Multipart form upload, field name `photo`.  
Saves the file to `public/photos/<timestamp><ext>`.  
Returns `{ filename: "1234567890.jpg" }`.

### `DELETE /api/photos/[filename]`
Deletes `public/photos/<filename>` from disk.

---

## Map configuration

```js
// Centre on Brunei
center: [4.535, 114.727]
zoom: 10
maxZoom: 22

// Layer 1 — Satellite base
url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
maxNativeZoom: 18, maxZoom: 22

// Layer 2 — Road overlay (on top of satellite)
url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
maxNativeZoom: 18, maxZoom: 22, opacity: 0.8

// Layer 3 — Labels overlay (on top of roads)
url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
maxNativeZoom: 18, maxZoom: 22, opacity: 0.9
```

---

## Marker colours

Markers use a custom SVG drop-pin icon (not Leaflet's default blue image):

- **Green** (`#27ae60`) — site has at least one flora or fauna entry
- **Blue** (`#2e86c1`) — site has no species data

SVG pin shape (24×36px, anchor at bottom centre):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
    fill="COLOR" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
  <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
</svg>
```

In react-leaflet, use `L.divIcon` with `iconSize: [24, 36]`, `iconAnchor: [12, 36]`, `popupAnchor: [0, -38]`.

---

## UI layout

```
┌─────────────────┬────────────────────────────────────┐
│   SIDEBAR       │                                    │
│  (300px fixed)  │                                    │
│                 │         MAP (fills rest)           │
│  [Search name ] │                                    │
│  ─────────────  │                                    │
│  Filter species │                                    │
│  [Search spec ] │                                    │
│  [Active badge] │                                    │
│  ─────────────  │                                    │
│  + Add by Coords│                                    │
│                 │                                    │
│  ┌─ Site card ┐ │                                    │
│  │ 🖼 Name    │ │                                    │
│  │   Flora:●● │ │                                    │
│  │   Fauna:●  │ │                                    │
│  └────────────┘ │                                    │
│  ┌─ Site card ┐ │                                    │
│  │ 📍 Name    │ │                                    │
│  └────────────┘ │                                    │
└─────────────────┴────────────────────────────────────┘
```

---

## Sidebar behaviour

### Site name search
- Filters the sidebar card list by site name (case-insensitive substring match)
- Also dims non-matching markers on the map (opacity 0.2)

### Species filter
- Separate input below the name search with a green border
- As the user types, show an autocomplete dropdown of all species that have been used across all sites (combined flora + fauna, sorted A–Z)
- On selection (click suggestion or press Enter): 
  1. Find all sites where `flora` or `fauna` contains that species (case-insensitive exact match)
  2. Dim non-matching markers to opacity 0.1
  3. Call `map.fitBounds()` on matching markers with 60px padding and maxZoom 14
  4. Render only matching sites in the sidebar list
  5. Show a green badge: "Showing: [species]"
  6. Show a ✕ clear button — clicking it restores everything
- Press Escape to clear the filter

### Site cards
Each card in the list shows:
- Thumbnail image (44×44px) if a photo exists, otherwise a 📍 placeholder
- Site name (bold)
- Flora line: `Flora: Nepenthes bicalcarata  Macaranga sp` (green label + green chip tags)
- Fauna line: `Fauna: Colobopsis schmitzi` (same style)
- Clicking a card pans the map to that site and opens its popup

---

## Add/Edit modal

Opens when:
- User clicks anywhere on the map (lat/lng pre-filled)
- User clicks "Add by Coordinates" (lat/lng blank, user types them)
- User clicks Edit in a popup

Fields:
1. **Name** (required text input)
2. **Latitude** and **Longitude** side by side (required number inputs, pre-filled on map click)
3. **Description** (textarea, optional)
4. **Flora** — tag-input: type a species name, press Enter or comma to add as a chip; backspace removes last chip; autocomplete dropdown shows all previously used flora species; chips are green rounded pills with an × remove button
5. **Fauna** — same as Flora but sourced from all fauna species seen across sites
6. **Photo** — file input (images only); shows thumbnail preview of existing photo when editing; "Remove photo" button to clear it

On save:
- Upload photo first if a new file was selected (POST /api/upload)
- Delete old photo if it was replaced or removed (DELETE /api/photos/[filename])
- Save site to array, POST /api/sites with full updated array
- Update marker on map (re-create with correct colour)
- Update sidebar card

---

## Popup content

When a marker is clicked, a Leaflet popup shows:
- Site name (bold, blue)
- Description text (if any)
- Flora tags (green label + green chips) if any
- Fauna tags (green label + green chips) if any
- Photo (full width, max 200px, if any)
- Edit button (blue) and Delete button (red)

Delete triggers a `confirm()` dialog before proceeding.

---

## Colour palette

| Use | Value |
|---|---|
| Primary blue (header, save btn, edit btn) | `#1a5276` |
| Species green | `#27ae60` |
| Green chip bg | `#e8f8f0` |
| Green chip border | `#a9dfbf` |
| Green chip text | `#1e8449` |
| Delete red | `#e74c3c` |
| Sidebar bg | `#ffffff` |
| Sidebar border | `#dddddd` |

---

## Source files (for reference)

The `source/` folder contains the original plain-HTML implementation:
- `index.html` — full app markup
- `style.css` — all styles
- `app.js` — all frontend logic (Leaflet init, CRUD, tag inputs, species filter)
- `server.js` — the original Express server (for API reference only — replace with Next.js API routes)

The logic in `app.js` can be adapted directly into React components and hooks.

---

## Data file

`data/sites.json` contains the 15 current research sites. Copy this to `data/sites.json` in the Next.js project root (or wherever the API route reads from). Make sure the directory is writable at runtime.

---

## Notes for Claude

- Leaflet **cannot run on the server** — wrap any component that imports Leaflet in `dynamic(() => import(...), { ssr: false })`.
- Use `fs.readFileSync` / `fs.writeFileSync` in API routes for the JSON file (this is fine for a single-user site).
- For file uploads, `formidable` is the most straightforward choice in Next.js API routes; disable the default body parser with `export const config = { api: { bodyParser: false } }`.
- The tag-input (flora/fauna) is a custom component — no external library needed; see `source/app.js` for the full implementation to port to React.
- The species autocomplete suggestions are derived at runtime from all existing sites — no separate storage needed.
- Keep the map cursor as `crosshair` so it's obvious the user can click to place a pin.
