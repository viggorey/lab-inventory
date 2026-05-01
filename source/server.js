const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const SITES_FILE = path.join(__dirname, 'sites.json');
const PHOTOS_DIR = path.join(__dirname, 'photos');

if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR);
if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');

const storage = multer.diskStorage({
  destination: PHOTOS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));
app.use('/photos', express.static(PHOTOS_DIR));

app.get('/api/sites', (req, res) => {
  const data = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
  res.json(data);
});

app.post('/api/sites', (req, res) => {
  fs.writeFileSync(SITES_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

app.delete('/api/photos/:filename', (req, res) => {
  const filepath = path.join(PHOTOS_DIR, req.params.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`BruneiMapApp running at http://localhost:${PORT}`);
});
