'use client';

import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import type { Site, SiteFormData } from '@/types/site';
import TagInput from './TagInput';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '', iconRetinaUrl: '' });
}

interface BruneiMapProps {
  isAdmin: boolean;
}

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  site?: Site;
  prefillLat?: number;
  prefillLng?: number;
}

function createSiteIcon(site: Site): L.DivIcon {
  const hasSpecies = (site.flora?.length ?? 0) > 0 || (site.fauna?.length ?? 0) > 0;
  const color = hasSpecies ? '#27ae60' : '#2e86c1';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
      fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
    <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -38] });
}

// ── Inner: listens for map clicks to open add modal ──────────────────────────
function MapClickHandler({
  modalOpen,
  onMapClick,
}: {
  modalOpen: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!modalOpen) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Inner: zooms map to matching sites when species filter is active ──────────
function SpeciesFilterController({
  activeSpecies,
  matchingSiteIds,
  allSites,
}: {
  activeSpecies: string | null;
  matchingSiteIds: Set<string>;
  allSites: Site[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!activeSpecies) return;
    const matching = allSites.filter((s) => matchingSiteIds.has(s.id));
    if (matching.length === 0) return;
    const bounds = L.latLngBounds(matching.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }, [activeSpecies, matchingSiteIds, allSites, map]);
  return null;
}

// ── Inner: single marker with opacity control ─────────────────────────────────
function SiteMarker({
  site,
  opacity,
  onEdit,
  onDelete,
  onOpen,
  isAdmin,
}: {
  site: Site;
  opacity: number;
  onEdit: (site: Site) => void;
  onDelete: (site: Site) => void;
  onOpen: (site: Site) => void;
  isAdmin: boolean;
}) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    markerRef.current?.setOpacity(opacity);
  }, [opacity]);

  return (
    <Marker
      ref={markerRef}
      position={[site.lat, site.lng]}
      icon={createSiteIcon(site)}
      eventHandlers={{ click: () => onOpen(site) }}
    >
      <Popup maxWidth={260}>
        <div className="text-sm" style={{ minWidth: '200px' }}>
          <div className="font-bold text-base mb-1" style={{ color: '#1a5276' }}>{site.name}</div>
          {site.description && <p className="text-gray-600 mb-2">{site.description}</p>}
          {(site.flora?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mb-1 items-center">
              <span className="text-xs font-semibold mr-1" style={{ color: '#27ae60' }}>Flora:</span>
              {site.flora.map((f) => (
                <span key={f} className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: '#e8f8f0', border: '1px solid #a9dfbf', color: '#1e8449' }}>
                  {f}
                </span>
              ))}
            </div>
          )}
          {(site.fauna?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 items-center">
              <span className="text-xs font-semibold mr-1" style={{ color: '#27ae60' }}>Fauna:</span>
              {site.fauna.map((f) => (
                <span key={f} className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: '#e8f8f0', border: '1px solid #a9dfbf', color: '#1e8449' }}>
                  {f}
                </span>
              ))}
            </div>
          )}
          {site.photoUrl && (
            <img src={site.photoUrl} alt={site.name} className="w-full rounded mb-2" style={{ maxHeight: '160px', objectFit: 'cover' }} />
          )}
          {isAdmin && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => onEdit(site)}
                className="flex-1 text-xs py-1 px-2 rounded text-white"
                style={{ background: '#1a5276' }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(site)}
                className="flex-1 text-xs py-1 px-2 rounded text-white"
                style={{ background: '#e74c3c' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BruneiMap({ isAdmin }: BruneiMapProps) {
  if (typeof window === 'undefined') return null;

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSpecies, setActiveSpecies] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesInput, setSpeciesInput] = useState('');
  const [showSpeciesSugg, setShowSpeciesSugg] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });

  // Modal form state
  const [formName, setFormName] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFlora, setFormFlora] = useState<string[]>([]);
  const [formFauna, setFormFauna] = useState<string[]>([]);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allFlora = useMemo(() => {
    const s = new Set<string>();
    sites.forEach((site) => site.flora?.forEach((f) => s.add(f)));
    return [...s].sort();
  }, [sites]);

  const allFauna = useMemo(() => {
    const s = new Set<string>();
    sites.forEach((site) => site.fauna?.forEach((f) => s.add(f)));
    return [...s].sort();
  }, [sites]);

  const allSpecies = useMemo(() => {
    const s = new Set([...allFlora, ...allFauna]);
    return [...s].sort();
  }, [allFlora, allFauna]);

  const matchingSiteIds = useMemo<Set<string>>(() => {
    if (!activeSpecies) return new Set();
    const lower = activeSpecies.toLowerCase();
    return new Set(
      sites
        .filter(
          (s) =>
            s.flora?.some((f) => f.toLowerCase() === lower) ||
            s.fauna?.some((f) => f.toLowerCase() === lower)
        )
        .map((s) => s.id)
    );
  }, [activeSpecies, sites]);

  const filteredSites = useMemo(() => {
    let result = sites;
    if (activeSpecies) result = result.filter((s) => matchingSiteIds.has(s.id));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [sites, activeSpecies, matchingSiteIds, searchTerm]);

  const speciesSuggestions = useMemo(() => {
    if (!speciesInput.trim()) return [];
    return allSpecies.filter((s) => s.toLowerCase().includes(speciesInput.toLowerCase()));
  }, [speciesInput, allSpecies]);

  // ── Load sites ─────────────────────────────────────────────────────────────
  const fetchSites = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sites').select('*').order('name');
    if (!error && data) setSites(data as Site[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // ── Signed URL on demand ───────────────────────────────────────────────────
  async function resolvePhotoUrl(site: Site): Promise<Site> {
    if (!site.photo || site.photoUrl) return site;
    const { data } = await supabase.storage
      .from('site-photos')
      .createSignedUrl(site.photo, 3600);
    return { ...site, photoUrl: data?.signedUrl };
  }

  async function handleSiteOpen(site: Site) {
    if (site.photo && !site.photoUrl) {
      const updated = await resolvePhotoUrl(site);
      setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  }

  // ── Marker opacity ─────────────────────────────────────────────────────────
  function getOpacity(siteId: string): number {
    if (activeSpecies && !matchingSiteIds.has(siteId)) return 0.1;
    if (searchTerm && !sites.find((s) => s.id === siteId)?.name.toLowerCase().includes(searchTerm.toLowerCase())) return 0.2;
    return 1;
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openAddModal(lat?: number, lng?: number) {
    setFormName(''); setFormLat(lat?.toFixed(6) ?? ''); setFormLng(lng?.toFixed(6) ?? '');
    setFormDesc(''); setFormFlora([]); setFormFauna([]);
    setFormPhotoFile(null); setFormPhotoPreview(null); setRemovePhoto(false);
    setModal({ open: true, mode: 'add', prefillLat: lat, prefillLng: lng });
  }

  function openEditModal(site: Site) {
    setFormName(site.name); setFormLat(String(site.lat)); setFormLng(String(site.lng));
    setFormDesc(site.description ?? ''); setFormFlora(site.flora ?? []); setFormFauna(site.fauna ?? []);
    setFormPhotoFile(null); setFormPhotoPreview(site.photoUrl ?? (site.photo ? null : null)); setRemovePhoto(false);
    setModal({ open: true, mode: 'edit', site });
  }

  function closeModal() {
    setModal({ open: false, mode: 'add' });
    if (formPhotoPreview && formPhotoFile) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(null); setFormPhotoPreview(null); setRemovePhoto(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (formPhotoPreview && formPhotoFile) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(file);
    setFormPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(formLat);
    const lng = parseFloat(formLng);
    if (!formName.trim() || isNaN(lat) || isNaN(lng)) {
      alert('Name, latitude, and longitude are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let photoPath = modal.mode === 'edit' ? (modal.site?.photo ?? null) : null;

      // Remove old photo
      if (removePhoto && photoPath) {
        await fetch(`/api/site-photos/${encodeURIComponent(photoPath)}`, { method: 'DELETE' });
        photoPath = null;
      }

      // Upload new photo
      if (formPhotoFile) {
        if (photoPath && !removePhoto) {
          await fetch(`/api/site-photos/${encodeURIComponent(photoPath)}`, { method: 'DELETE' });
        }
        const fd = new FormData();
        fd.append('photo', formPhotoFile);
        const res = await fetch('/api/site-photos', { method: 'POST', body: fd });
        const json = await res.json();
        photoPath = json.path ?? null;
      }

      const payload: Partial<Site> = {
        name: formName.trim(),
        lat,
        lng,
        description: formDesc.trim() || null,
        flora: formFlora,
        fauna: formFauna,
        photo: photoPath,
      };

      if (modal.mode === 'add') {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from('sites').insert(payload).select().single();
        if (error) throw error;
        setSites((prev) => [...prev, data as Site]);
      } else {
        const { data, error } = await supabase.from('sites').update(payload).eq('id', modal.site!.id).select().single();
        if (error) throw error;
        setSites((prev) => prev.map((s) => (s.id === (data as Site).id ? (data as Site) : s)));
      }
      closeModal();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save site.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(site: Site) {
    if (!confirm(`Delete "${site.name}"?`)) return;
    if (site.photo) {
      await fetch(`/api/site-photos/${encodeURIComponent(site.photo)}`, { method: 'DELETE' });
    }
    const { error } = await supabase.from('sites').delete().eq('id', site.id);
    if (error) { alert(error.message); return; }
    setSites((prev) => prev.filter((s) => s.id !== site.id));
  }

  // ── Species filter ─────────────────────────────────────────────────────────
  function applySpecies(species: string) {
    setActiveSpecies(species);
    setSpeciesInput(species);
    setShowSpeciesSugg(false);
  }

  function clearSpecies() {
    setActiveSpecies(null);
    setSpeciesInput('');
    setShowSpeciesSugg(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '75vh' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row border border-gray-200 rounded-xl overflow-hidden" style={{ height: '75vh', minHeight: '500px' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-full md:w-[300px] md:flex-shrink-0 h-[260px] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-200 bg-white overflow-hidden">
        {/* Search by name */}
        <div className="p-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search sites…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Species filter */}
        <div className="p-3 border-b border-gray-100 relative">
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Filter by species…"
              value={speciesInput}
              onChange={(e) => { setSpeciesInput(e.target.value); setShowSpeciesSugg(e.target.value.trim().length > 0); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && speciesInput.trim()) { e.preventDefault(); applySpecies(speciesInput.trim()); }
                if (e.key === 'Escape') clearSpecies();
              }}
              onBlur={() => setTimeout(() => setShowSpeciesSugg(false), 150)}
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ borderColor: '#27ae60' }}
            />
            {activeSpecies && (
              <button onClick={clearSpecies} className="px-2 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">✕</button>
            )}
          </div>
          {activeSpecies && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#e8f8f0', border: '1px solid #a9dfbf', color: '#1e8449' }}>
                Showing: {activeSpecies}
              </span>
            </div>
          )}
          {showSpeciesSugg && speciesSuggestions.length > 0 && (
            <ul className="absolute left-3 right-3 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto">
              {speciesSuggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); applySpecies(s); }}
                  className="px-3 py-1.5 text-sm hover:bg-green-50 cursor-pointer"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add by coords button */}
        {isAdmin && (
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => openAddModal()}
              className="w-full text-sm py-1.5 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
            >
              + Add by Coordinates
            </button>
          </div>
        )}

        {/* Site list */}
        <div className="flex-1 overflow-y-auto">
          {filteredSites.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">
              {activeSpecies ? 'No sites match this species.' : searchTerm ? 'No sites match your search.' : 'No sites yet.'}
            </p>
          ) : (
            filteredSites.map((site) => (
              <button
                key={site.id}
                onClick={() => {
                  handleSiteOpen(site);
                  mapRef.current?.setView([site.lat, site.lng], Math.max(mapRef.current.getZoom(), 14));
                }}
                className="w-full flex items-center gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 text-left transition-colors"
              >
                {site.photoUrl ? (
                  <img src={site.photoUrl} alt={site.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded flex-shrink-0 text-lg">📍</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{site.name}</p>
                  {(site.flora?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      <span style={{ color: '#27ae60' }}>Flora:</span> {site.flora.join(', ')}
                    </p>
                  )}
                  {(site.fauna?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      <span style={{ color: '#27ae60' }}>Fauna:</span> {site.fauna.join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative" style={{ minHeight: '240px' }}>
        <MapContainer
          ref={mapRef}
          center={[4.535, 114.727]}
          zoom={10}
          maxZoom={22}
          style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={18}
            maxZoom={22}
            attribution="Tiles &copy; Esri"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={18}
            maxZoom={22}
            opacity={0.8}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={18}
            maxZoom={22}
            opacity={0.9}
          />
          <MapClickHandler modalOpen={modal.open} onMapClick={isAdmin ? openAddModal : () => {}} />
          <SpeciesFilterController activeSpecies={activeSpecies} matchingSiteIds={matchingSiteIds} allSites={sites} />
          {sites.map((site) => (
            <SiteMarker
              key={site.id}
              site={site}
              opacity={getOpacity(site.id)}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onOpen={handleSiteOpen}
              isAdmin={isAdmin}
            />
          ))}
        </MapContainer>
      </div>

      {/* ── Add/Edit Modal ───────────────────────────────────────────────────── */}
      {modal.open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold" style={{ color: '#1a5276' }}>
                {modal.mode === 'add' ? 'Add Site' : 'Edit Site'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flora</label>
                <TagInput values={formFlora} onChange={setFormFlora} suggestions={allFlora} placeholder="Type species, press Enter…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fauna</label>
                <TagInput values={formFauna} onChange={setFormFauna} suggestions={allFauna} placeholder="Type species, press Enter…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                {(formPhotoPreview || (modal.mode === 'edit' && modal.site?.photoUrl && !removePhoto)) && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={formPhotoPreview ?? modal.site?.photoUrl ?? ''}
                      alt="Preview"
                      className="h-24 rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => { setRemovePhoto(true); setFormPhotoFile(null); setFormPhotoPreview(null); }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: '#1a5276' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
