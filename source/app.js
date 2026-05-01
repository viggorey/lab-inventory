// ── State ────────────────────────────────────────────────────────────────────
let sites = [];
let markers = {};       // id → Leaflet marker
let activeCardId = null;
let editingPhotoFilename = null;
let removeExistingPhoto = false;
let activeSpeciesFilter = null;

// ── Map init ─────────────────────────────────────────────────────────────────
const map = L.map('map', { maxZoom: 22 }).setView([4.535, 114.727], 10);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  maxNativeZoom: 18,
  maxZoom: 22,
}).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
  maxNativeZoom: 18,
  maxZoom: 22,
  opacity: 0.8,
}).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxNativeZoom: 18,
  maxZoom: 22,
  opacity: 0.9,
}).addTo(map);

// ── DOM refs ─────────────────────────────────────────────────────────────────
const overlay       = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const siteForm      = document.getElementById('site-form');
const fieldId       = document.getElementById('field-id');
const fieldName     = document.getElementById('field-name');
const fieldLat      = document.getElementById('field-lat');
const fieldLng      = document.getElementById('field-lng');
const fieldDesc     = document.getElementById('field-desc');
const fieldPhoto    = document.getElementById('field-photo');
const photoPreview  = document.getElementById('photo-preview');
const photoWrap     = document.getElementById('photo-preview-wrap');
const btnRemovePhoto = document.getElementById('btn-remove-photo');
const btnSave       = document.getElementById('btn-save');
const btnCancel     = document.getElementById('btn-cancel');
const btnCoords     = document.getElementById('btn-coords');
const searchInput         = document.getElementById('search-input');
const siteList            = document.getElementById('site-list');
const tiFlora             = document.getElementById('ti-flora');
const tiFauna             = document.getElementById('ti-fauna');
const speciesSearchInput  = document.getElementById('species-search-input');
const speciesSuggestions  = document.getElementById('species-suggestions');
const btnClearSpecies     = document.getElementById('btn-clear-species');
const speciesBadge        = document.getElementById('species-badge');

// ── Utilities ─────────────────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function saveSites() {
  await fetch('/api/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sites),
  });
}

async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append('photo', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  return data.filename;
}

async function deletePhotoFromServer(filename) {
  if (!filename) return;
  await fetch(`/api/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}

// ── Tag-input component ───────────────────────────────────────────────────────
function getAllFlora() {
  const all = new Set();
  sites.forEach(s => (s.flora || []).forEach(v => all.add(v)));
  return [...all].sort();
}

function getAllFauna() {
  const all = new Set();
  sites.forEach(s => (s.fauna || []).forEach(v => all.add(v)));
  return [...all].sort();
}

function getAllSpecies() {
  const all = new Set();
  sites.forEach(s => {
    (s.flora || []).forEach(v => all.add(v));
    (s.fauna || []).forEach(v => all.add(v));
  });
  return [...all].sort();
}

function initTagInput(wrap, getSuggestions) {
  const list        = wrap.querySelector('.tag-list');
  const field       = wrap.querySelector('.tag-field');
  const suggestions = wrap.querySelector('.tag-suggestions');

  wrap.addEventListener('click', () => field.focus());

  field.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && field.value.trim()) {
      e.preventDefault();
      addTag(wrap, field.value.trim());
      field.value = '';
      hideTagSuggestions(suggestions);
    } else if (e.key === 'Backspace' && !field.value) {
      const chips = list.querySelectorAll('.tag-chip');
      if (chips.length) chips[chips.length - 1].remove();
    }
  });

  field.addEventListener('input', () => {
    const q = field.value.trim().toLowerCase();
    if (!q) { hideTagSuggestions(suggestions); return; }

    const current = getTagValues(wrap);
    const matches = getSuggestions().filter(s =>
      s.toLowerCase().includes(q) && !current.includes(s)
    );

    if (!matches.length) { hideTagSuggestions(suggestions); return; }

    suggestions.innerHTML = '';
    matches.forEach(m => {
      const li = document.createElement('li');
      li.className = 'tag-suggestion';
      li.textContent = m;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addTag(wrap, m);
        field.value = '';
        hideTagSuggestions(suggestions);
      });
      suggestions.appendChild(li);
    });
    suggestions.classList.remove('hidden');
  });

  field.addEventListener('blur', () => {
    setTimeout(() => hideTagSuggestions(suggestions), 150);
  });

  suggestions.addEventListener('click', (e) => e.stopPropagation());
}

function hideTagSuggestions(suggestions) {
  suggestions.innerHTML = '';
  suggestions.classList.add('hidden');
}

function addTag(wrap, value) {
  const v = value.trim();
  if (!v) return;
  if (getTagValues(wrap).includes(v)) return;

  const list  = wrap.querySelector('.tag-list');
  const field = wrap.querySelector('.tag-field');

  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.dataset.value = v;

  const text = document.createElement('span');
  text.textContent = v;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tag-chip-remove';
  btn.innerHTML = '&times;';
  btn.addEventListener('click', () => chip.remove());

  chip.appendChild(text);
  chip.appendChild(btn);
  list.insertBefore(chip, field);
}

function getTagValues(wrap) {
  return [...wrap.querySelectorAll('.tag-chip')].map(c => c.dataset.value);
}

function setTagValues(wrap, values) {
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
  (values || []).forEach(v => addTag(wrap, v));
}

function clearTagInputs() {
  [tiFlora, tiFauna].forEach(ti => {
    ti.querySelectorAll('.tag-chip').forEach(c => c.remove());
    ti.querySelector('.tag-field').value = '';
    hideTagSuggestions(ti.querySelector('.tag-suggestions'));
  });
}

// ── Sidebar rendering ─────────────────────────────────────────────────────────
function renderSidebar(filter = '', sourceSites = null) {
  siteList.innerHTML = '';
  const source = sourceSites !== null ? sourceSites : sites;
  const q = filter.toLowerCase();
  const filtered = q ? source.filter(s => s.name.toLowerCase().includes(q)) : source;

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.id = 'no-results';
    li.textContent = sourceSites !== null
      ? 'No sites found with this species.'
      : (filter ? 'No sites match your search.' : 'No sites yet. Click the map to add one.');
    siteList.appendChild(li);
    return;
  }

  filtered.forEach(site => {
    const li = document.createElement('li');
    li.className = 'site-card' + (site.id === activeCardId ? ' active' : '');
    li.dataset.id = site.id;

    if (site.photo) {
      const img = document.createElement('img');
      img.className = 'site-card-thumb';
      img.src = `/photos/${site.photo}`;
      img.alt = site.name;
      li.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'site-card-thumb-placeholder';
      ph.textContent = '📍';
      li.appendChild(ph);
    }

    const textCol = document.createElement('div');
    textCol.className = 'site-card-text';

    const name = document.createElement('span');
    name.className = 'site-card-name';
    name.textContent = site.name;
    textCol.appendChild(name);

    if (site.flora && site.flora.length > 0) {
      const row = document.createElement('div');
      row.className = 'site-card-species';
      row.innerHTML = `<span class="scs-label">Flora:</span> ${site.flora.map(f => `<span class="scs-tag">${escapeHtml(f)}</span>`).join('')}`;
      textCol.appendChild(row);
    }
    if (site.fauna && site.fauna.length > 0) {
      const row = document.createElement('div');
      row.className = 'site-card-species';
      row.innerHTML = `<span class="scs-label">Fauna:</span> ${site.fauna.map(f => `<span class="scs-tag">${escapeHtml(f)}</span>`).join('')}`;
      textCol.appendChild(row);
    }

    li.appendChild(textCol);
    li.addEventListener('click', () => focusSite(site.id));
    siteList.appendChild(li);
  });
}

function setActiveCard(id) {
  activeCardId = id;
  document.querySelectorAll('.site-card').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

// ── Marker management ─────────────────────────────────────────────────────────
function createMarkerIcon(site) {
  const hasSpecies = (site.flora && site.flora.length > 0) || (site.fauna && site.fauna.length > 0);
  const color = hasSpecies ? '#27ae60' : '#2e86c1';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
      fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
    <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -38],
  });
}
function buildPopupHTML(site) {
  let html = `<div class="popup-name">${escapeHtml(site.name)}</div>`;
  if (site.description) {
    html += `<div class="popup-desc">${escapeHtml(site.description)}</div>`;
  }
  if (site.flora?.length) {
    const tags = site.flora.map(f => `<span class="popup-species-tag">${escapeHtml(f)}</span>`).join('');
    html += `<div class="popup-species"><span class="popup-species-label">Flora:</span>${tags}</div>`;
  }
  if (site.fauna?.length) {
    const tags = site.fauna.map(f => `<span class="popup-species-tag">${escapeHtml(f)}</span>`).join('');
    html += `<div class="popup-species"><span class="popup-species-label">Fauna:</span>${tags}</div>`;
  }
  if (site.photo) {
    html += `<img class="popup-photo" src="/photos/${site.photo}" alt="${escapeHtml(site.name)}" />`;
  }
  html += `<div class="popup-actions">
    <button class="popup-btn popup-btn-edit" onclick="openEditModal('${site.id}')">Edit</button>
    <button class="popup-btn popup-btn-delete" onclick="confirmDelete('${site.id}')">Delete</button>
  </div>`;
  return html;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addMarker(site) {
  if (markers[site.id]) {
    map.removeLayer(markers[site.id]);
  }
  const marker = L.marker([site.lat, site.lng], { icon: createMarkerIcon(site) }).addTo(map);
  marker.bindPopup(buildPopupHTML(site), { maxWidth: 240 });
  marker.on('click', () => setActiveCard(site.id));
  markers[site.id] = marker;
}

function removeMarker(id) {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
}

function focusSite(id) {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  setActiveCard(id);
  map.setView([site.lat, site.lng], Math.max(map.getZoom(), 14));
  markers[id]?.openPopup();
}

function applySearchFilter(q) {
  const lower = q.toLowerCase();
  sites.forEach(site => {
    const marker = markers[site.id];
    if (!marker) return;
    if (site.name.toLowerCase().includes(lower)) {
      marker.setOpacity(1);
    } else {
      marker.setOpacity(0.2);
    }
  });
}

// ── Species filter ────────────────────────────────────────────────────────────
function matchesSpecies(site, species) {
  const s = species.toLowerCase();
  return (site.flora || []).some(f => f.toLowerCase() === s) ||
         (site.fauna || []).some(f => f.toLowerCase() === s);
}

function applySpeciesFilter(species) {
  activeSpeciesFilter = species;
  speciesSearchInput.value = species;
  speciesSuggestions.innerHTML = '';
  speciesSuggestions.classList.add('hidden');
  btnClearSpecies.classList.remove('hidden');
  speciesBadge.textContent = `Showing: ${species}`;
  speciesBadge.classList.remove('hidden');

  const matching = sites.filter(s => matchesSpecies(s, species));

  renderSidebar(searchInput.value, matching);

  sites.forEach(site => {
    const marker = markers[site.id];
    if (!marker) return;
    marker.setOpacity(matching.some(m => m.id === site.id) ? 1 : 0.1);
  });

  if (matching.length > 0) {
    const group = L.featureGroup(matching.map(s => markers[s.id]).filter(Boolean));
    map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 14 });
  }
}

function clearSpeciesFilter() {
  activeSpeciesFilter = null;
  speciesSearchInput.value = '';
  speciesSuggestions.innerHTML = '';
  speciesSuggestions.classList.add('hidden');
  btnClearSpecies.classList.add('hidden');
  speciesBadge.classList.add('hidden');

  sites.forEach(site => {
    const marker = markers[site.id];
    if (marker) marker.setOpacity(1);
  });

  renderSidebar(searchInput.value);
  applySearchFilter(searchInput.value);
}

// ── Load sites from server ────────────────────────────────────────────────────
async function loadSites() {
  const res = await fetch('/api/sites');
  sites = await res.json();
  sites.forEach(addMarker);
  renderSidebar();
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal({ title, id = '', name = '', lat = '', lng = '', description = '', photo = '', flora = [], fauna = [] }) {
  modalTitle.textContent = title;
  fieldId.value    = id;
  fieldName.value  = name;
  fieldLat.value   = lat;
  fieldLng.value   = lng;
  fieldDesc.value  = description;
  fieldPhoto.value = '';
  editingPhotoFilename = photo || null;
  removeExistingPhoto  = false;

  setTagValues(tiFlora, flora);
  setTagValues(tiFauna, fauna);

  if (photo) {
    photoPreview.src = `/photos/${photo}`;
    photoWrap.classList.remove('hidden');
  } else {
    photoWrap.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
  fieldName.focus();
}

function closeModal() {
  overlay.classList.add('hidden');
  siteForm.reset();
  editingPhotoFilename = null;
  removeExistingPhoto  = false;
  photoWrap.classList.add('hidden');
  clearTagInputs();
}

function openAddModal(lat, lng) {
  openModal({ title: 'Add Site', lat: lat ? lat.toFixed(6) : '', lng: lng ? lng.toFixed(6) : '' });
}

function openEditModal(id) {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  map.closePopup();
  openModal({
    title: 'Edit Site',
    id: site.id,
    name: site.name,
    lat: site.lat,
    lng: site.lng,
    description: site.description || '',
    photo: site.photo || '',
    flora: site.flora || [],
    fauna: site.fauna || [],
  });
}

function confirmDelete(id) {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  if (!confirm(`Delete "${site.name}"?`)) return;
  deleteSite(id);
}

async function deleteSite(id) {
  const site = sites.find(s => s.id === id);
  if (site?.photo) await deletePhotoFromServer(site.photo);
  sites = sites.filter(s => s.id !== id);
  removeMarker(id);
  if (activeCardId === id) activeCardId = null;
  await saveSites();
  if (activeSpeciesFilter) {
    applySpeciesFilter(activeSpeciesFilter);
  } else {
    renderSidebar(searchInput.value);
  }
  map.closePopup();
}

// ── Form submit ───────────────────────────────────────────────────────────────
siteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSave.disabled = true;
  btnSave.textContent = 'Saving…';

  try {
    const id   = fieldId.value || uuid();
    const lat  = parseFloat(fieldLat.value);
    const lng  = parseFloat(fieldLng.value);

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates.');
      return;
    }

    let photoFilename = editingPhotoFilename;

    if (removeExistingPhoto && editingPhotoFilename) {
      await deletePhotoFromServer(editingPhotoFilename);
      photoFilename = null;
    }

    if (fieldPhoto.files[0]) {
      if (editingPhotoFilename && !removeExistingPhoto) {
        await deletePhotoFromServer(editingPhotoFilename);
      }
      photoFilename = await uploadPhoto(fieldPhoto.files[0]);
    }

    const site = {
      id,
      name: fieldName.value.trim(),
      lat,
      lng,
      description: fieldDesc.value.trim(),
      photo: photoFilename || '',
      flora: getTagValues(tiFlora),
      fauna: getTagValues(tiFauna),
    };

    const existingIdx = sites.findIndex(s => s.id === id);
    if (existingIdx >= 0) {
      sites[existingIdx] = site;
    } else {
      sites.push(site);
    }

    await saveSites();
    addMarker(site);
    if (activeSpeciesFilter) {
      applySpeciesFilter(activeSpeciesFilter);
    } else {
      renderSidebar(searchInput.value);
    }
    closeModal();
    focusSite(id);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Save';
  }
});

// ── Event listeners ───────────────────────────────────────────────────────────
map.on('click', (e) => {
  if (overlay.classList.contains('hidden')) {
    openAddModal(e.latlng.lat, e.latlng.lng);
  }
});

btnCoords.addEventListener('click', () => openAddModal(null, null));
btnCancel.addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

btnRemovePhoto.addEventListener('click', () => {
  removeExistingPhoto = true;
  editingPhotoFilename = null;
  photoWrap.classList.add('hidden');
  fieldPhoto.value = '';
});

fieldPhoto.addEventListener('change', () => {
  if (fieldPhoto.files[0]) {
    photoPreview.src = URL.createObjectURL(fieldPhoto.files[0]);
    photoWrap.classList.remove('hidden');
    removeExistingPhoto = false;
  }
});

searchInput.addEventListener('input', () => {
  const q = searchInput.value;
  if (activeSpeciesFilter) {
    const matching = sites.filter(s => matchesSpecies(s, activeSpeciesFilter));
    renderSidebar(q, matching);
  } else {
    renderSidebar(q);
    applySearchFilter(q);
  }
});

// ── Species search listeners ──────────────────────────────────────────────────
speciesSearchInput.addEventListener('input', () => {
  const q = speciesSearchInput.value.trim().toLowerCase();
  if (!q) { speciesSuggestions.innerHTML = ''; speciesSuggestions.classList.add('hidden'); return; }

  const matches = getAllSpecies().filter(s => s.toLowerCase().includes(q));
  if (!matches.length) { speciesSuggestions.innerHTML = ''; speciesSuggestions.classList.add('hidden'); return; }

  speciesSuggestions.innerHTML = '';
  matches.forEach(m => {
    const li = document.createElement('li');
    li.className = 'species-sugg-item';
    li.textContent = m;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applySpeciesFilter(m);
    });
    speciesSuggestions.appendChild(li);
  });
  speciesSuggestions.classList.remove('hidden');
});

speciesSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && speciesSearchInput.value.trim()) {
    e.preventDefault();
    applySpeciesFilter(speciesSearchInput.value.trim());
  } else if (e.key === 'Escape') {
    clearSpeciesFilter();
  }
});

speciesSearchInput.addEventListener('blur', () => {
  setTimeout(() => { speciesSuggestions.innerHTML = ''; speciesSuggestions.classList.add('hidden'); }, 150);
});

btnClearSpecies.addEventListener('click', clearSpeciesFilter);

// ── Boot ──────────────────────────────────────────────────────────────────────
initTagInput(tiFlora, getAllFlora);
initTagInput(tiFauna, getAllFauna);
loadSites();
