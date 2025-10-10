import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  // --- CORS headers ---

        res.setHeader("Access-Control-Allow-Origin", "*");  // or a specific origin
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
        if (req.method === "OPTIONS") {
          return res.status(200).end();
        }

      
  // 1️⃣ Only accept POST
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 2️⃣ Get the keyword row
  const row = req.body;
  if (!row || !row.mot) return res.status(400).json({ error: "Invalid row" });

  try {
    // 3️⃣ Save in KV
    // Key: "keyword:<mot>"
    // Value: JSON string of the row
    await kv.set(`keyword:${row.mot}`, JSON.stringify(row));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save keyword" });
  }
}
