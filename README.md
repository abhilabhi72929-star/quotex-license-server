# Quotex Premium License Server

## Features
- **1 License Key = 1 Device** (fingerprint binding)
- Key ban / unban anytime
- Device reset (agar user naya mobile use kare)
- Optional expiry days
- Simple JSON file storage (no database needed)

## Setup (Server)

1. Folder me jaao:
   ```bash
   cd quotex-license-server
   npm install
   ```

2. Admin secret change karo (important):
   - `server.js` me `ADMIN_SECRET` change karo
   - Ya environment variable set karo: `ADMIN_SECRET=your_strong_password`

3. Server start:
   ```bash
   npm start
   ```
   Default: http://localhost:3000

4. Public host karne ke liye (Railway / Render / VPS / any Node host):
   - Port environment se aata hai (`PORT`)
   - Domain / URL note kar lo

## Extension me Server URL set karo

File: `ewpntwciqyxepolqqvct.js`

Line ~12 pe:
```js
const SERVER_URL = "https://YOUR-LICENSE-SERVER.com";
```
Apna real server URL daal do (example: `https://my-license.up.railway.app`)

Phir extension reload karo.

## Admin Commands (keys manage karne ke liye)

Server running hona chahiye.

```bash
# 5 keys generate karo (name optional)
node admin.js generate 5 "Customer Name"

# 30 days expiry wali keys
node admin.js generate 3 "VIP User" 30

# Key ban karo
node admin.js ban RS-XXXXXXXXXXXXXXXX

# Unban
node admin.js unban RS-XXXXXXXXXXXXXXXX

# Device reset (naya mobile allow)
node admin.js reset RS-XXXXXXXXXXXXXXXX

# Saari keys list
node admin.js list

# Key delete
node admin.js delete RS-XXXXXXXXXXXXXXXX
```

## Flow kaise kaam karta hai

1. User extension install karta hai → License prompt dikhega
2. Aap key generate karke do (Telegram/WhatsApp se)
3. User key enter kare → pehli baar us device se bind ho jaati hai
4. Dusre mobile/device pe same key use nahi hogi
5. Agar ban karna hai → `node admin.js ban KEY`
6. User naya mobile le → aap `reset` karke us key ko free kar do

## Security Notes
- `ADMIN_SECRET` strong rakho
- Server HTTPS pe host karo (production me)
- `licenses.json` backup lete raho
