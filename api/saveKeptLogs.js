import { put, get } from "@vercel/blob";

// 🔧 Helper to enable CORS (needed for browser extension)
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const blobName = "keptLogs.json";

  try {
    if (req.method === "POST") {
      // Expecting an array of log entries
      const keptLogs = req.body;
      if (!Array.isArray(keptLogs)) {
        return res.status(400).json({ error: "Body must be an array" });
      }

      // Save as JSON to Vercel Blob (public so frontend can read)
      await put(blobName, JSON.stringify(keptLogs, null, 2), {
        access: "public",
        contentType: "application/json",
      });

      return res.status(200).json({ success: true, count: keptLogs.length });
    }

    if (req.method === "GET") {
      // Retrieve the saved JSON file
      const file = await get(blobName);
      if (!file?.url) {
        return res.status(404).json({ error: "No kept logs found" });
      }

      const response = await fetch(file.url);
      const data = await response.json();

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in saveKeptLogs:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
