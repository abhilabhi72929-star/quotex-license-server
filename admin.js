/**
 * Simple CLI admin tool
 * Usage examples:
 *   node admin.js generate 5 "Customer Name"
 *   node admin.js ban RS-XXXX
 *   node admin.js unban RS-XXXX
 *   node admin.js reset RS-XXXX
 *   node admin.js list
 *   node admin.js delete RS-XXXX
 */

const http = require("http");

const SERVER = process.env.LICENSE_SERVER || "http://localhost:3000";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ROCKSTAR_ADMIN_CHANGE_ME_123";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": ADMIN_SECRET,
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const [,, cmd, ...args] = process.argv;
  if (!cmd) {
    console.log(`
Commands:
  generate [count] [name] [days]   Generate keys (default 1, permanent)
  ban <key>                        Ban a key
  unban <key>                      Unban a key
  reset <key>                      Reset device binding (allow new device)
  list                             List all keys
  delete <key>                     Delete a key
`);
    process.exit(0);
  }

  try {
    let result;
    switch (cmd) {
      case "generate": {
        const count = parseInt(args[0] || "1", 10);
        const name = args[1] || "User";
        const days = parseInt(args[2] || "0", 10);
        result = await request("POST", "/api/admin/generate", { count, name, days });
        console.log("Generated keys:");
        (result.keys || []).forEach((k) => console.log("  " + k));
        break;
      }
      case "ban":
        result = await request("POST", "/api/admin/ban", { key: args[0] });
        console.log(result);
        break;
      case "unban":
        result = await request("POST", "/api/admin/unban", { key: args[0] });
        console.log(result);
        break;
      case "reset":
        result = await request("POST", "/api/admin/reset-device", { key: args[0] });
        console.log(result);
        break;
      case "list":
        result = await request("GET", "/api/admin/list");
        console.table(result.licenses || []);
        break;
      case "delete":
        result = await request("POST", "/api/admin/delete", { key: args[0] });
        console.log(result);
        break;
      default:
        console.log("Unknown command:", cmd);
    }
  } catch (e) {
    console.error("Error:", e.message);
    console.error("Make sure server is running: npm start");
  }
}

main();
