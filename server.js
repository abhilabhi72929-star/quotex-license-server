/**
 * Quotex Premium License Server
 * Features:
 *  - 1 License Key = 1 Device (fingerprint binding)
 *  - Ban / Unban keys anytime
 *  - Generate new keys
 *  - Simple JSON file storage (no DB needed)
 *
 * Run: npm install && npm start
 * Default port: 3000
 * Admin secret: change ADMIN_SECRET below
 */

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "licenses.json");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ROCKSTAR_ADMIN_CHANGE_ME_123"; // <-- change this!

app.use(cors());
app.use(bodyParser.json());

// ---------- Storage helpers ----------
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { licenses: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- Public endpoints (extension calls these) ----------

/**
 * POST /api/validate
 * Body: { key, fingerprint }
 * Returns: { valid, message, data? }
 */
app.post("/api/validate", (req, res) => {
  try {
    const { key, fingerprint } = req.body;
    if (!key || !fingerprint) {
      return res.json({ valid: false, message: "Key and fingerprint required" });
    }

    const data = loadData();
    const lic = data.licenses[key.trim().toUpperCase()];

    if (!lic) {
      return res.json({ valid: false, message: "Invalid license key" });
    }
    if (lic.banned) {
      return res.json({ valid: false, message: "License key has been banned" });
    }
    if (lic.expiresAt && Date.now() > lic.expiresAt) {
      return res.json({ valid: false, message: "License key has expired" });
    }

    // First activation → bind to this device
    if (!lic.fingerprint) {
      lic.fingerprint = fingerprint;
      lic.activatedAt = Date.now();
      lic.lastUsed = Date.now();
      data.licenses[key.trim().toUpperCase()] = lic;
      saveData(data);
      return res.json({
        valid: true,
        message: "License activated successfully",
        data: {
          name: lic.name || "User",
          userName: lic.name || "User",
          licenseKey: key.trim().toUpperCase(),
          fingerprint,
          licenseValidated: true,
          timestamp: Date.now()
        }
      });
    }

    // Already bound → only same device allowed
    if (lic.fingerprint !== fingerprint) {
      return res.json({
        valid: false,
        message: "This key is already activated on another device"
      });
    }

    lic.lastUsed = Date.now();
    data.licenses[key.trim().toUpperCase()] = lic;
    saveData(data);

    return res.json({
      valid: true,
      message: "License valid",
      data: {
        name: lic.name || "User",
        userName: lic.name || "User",
        licenseKey: key.trim().toUpperCase(),
        fingerprint,
        licenseValidated: true,
        timestamp: Date.now()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

/**
 * POST /api/heartbeat  (optional periodic check)
 */
app.post("/api/heartbeat", (req, res) => {
  const { key, fingerprint } = req.body;
  if (!key || !fingerprint) return res.json({ valid: false });

  const data = loadData();
  const lic = data.licenses[key.trim().toUpperCase()];
  if (!lic || lic.banned || (lic.fingerprint && lic.fingerprint !== fingerprint)) {
    return res.json({ valid: false, message: "License invalid or banned" });
  }
  lic.lastUsed = Date.now();
  saveData(data);
  res.json({ valid: true });
});

// ---------- Admin endpoints (protect with secret) ----------
function checkAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"] || req.body?.adminSecret;
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Generate new keys
app.post("/api/admin/generate", checkAdmin, (req, res) => {
  const { count = 1, name = "User", days = 0 } = req.body;
  const data = loadData();
  const keys = [];

  for (let i = 0; i < Math.min(count, 50); i++) {
    const key = "RS-" + uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase();
    data.licenses[key] = {
      name,
      fingerprint: null,
      banned: false,
      createdAt: Date.now(),
      activatedAt: null,
      lastUsed: null,
      expiresAt: days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null
    };
    keys.push(key);
  }
  saveData(data);
  res.json({ success: true, keys });
});

// Ban a key
app.post("/api/admin/ban", checkAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  const data = loadData();
  const k = key.trim().toUpperCase();
  if (!data.licenses[k]) return res.status(404).json({ error: "Key not found" });
  data.licenses[k].banned = true;
  saveData(data);
  res.json({ success: true, message: `Key ${k} banned` });
});

// Unban a key
app.post("/api/admin/unban", checkAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  const data = loadData();
  const k = key.trim().toUpperCase();
  if (!data.licenses[k]) return res.status(404).json({ error: "Key not found" });
  data.licenses[k].banned = false;
  saveData(data);
  res.json({ success: true, message: `Key ${k} unbanned` });
});

// Reset device binding (so key can be used on new device)
app.post("/api/admin/reset-device", checkAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  const data = loadData();
  const k = key.trim().toUpperCase();
  if (!data.licenses[k]) return res.status(404).json({ error: "Key not found" });
  data.licenses[k].fingerprint = null;
  data.licenses[k].activatedAt = null;
  saveData(data);
  res.json({ success: true, message: `Device binding reset for ${k}` });
});

// List all keys
app.get("/api/admin/list", checkAdmin, (req, res) => {
  const data = loadData();
  const list = Object.entries(data.licenses).map(([key, v]) => ({
    key,
    name: v.name,
    banned: v.banned,
    fingerprint: v.fingerprint ? v.fingerprint.substring(0, 12) + "..." : null,
    activated: !!v.fingerprint,
    createdAt: v.createdAt,
    lastUsed: v.lastUsed,
    expiresAt: v.expiresAt
  }));
  res.json({ licenses: list });
});

// Delete key
app.post("/api/admin/delete", checkAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  const data = loadData();
  const k = key.trim().toUpperCase();
  if (!data.licenses[k]) return res.status(404).json({ error: "Key not found" });
  delete data.licenses[k];
  saveData(data);
  res.json({ success: true, message: `Key ${k} deleted` });
});

// Health
app.get("/", (req, res) => {
  res.json({ status: "Quotex License Server running", version: "1.0" });
});

app.listen(PORT, () => {
  console.log(`License server running on http://localhost:${PORT}`);
  console.log(`Admin secret: ${ADMIN_SECRET}`);
  console.log(`Data file: ${DATA_FILE}`);
});
