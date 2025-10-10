import { list, get } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // list all blobs in your storage
    const { blobs } = await list();
    console.log("📦 Found blobs:", blobs.map(b => b.pathname));

    // look for your keywords blob
    const blob = blobs.find(b => b.pathname === "data.csv");
    if (!blob) {
      console.log("ℹ️ No data.csv blob found, returning empty array");
      return res.status(200).json([]);
    }

    // fetch its content
    const response = await fetch(blob.url);
    const text = await response.text();

    console.log("✅ Blob content length:", text.length);
    return res.status(200).json(parseCSV(text));

  } catch (err) {
    console.error("❌ Error in getKeywords handler:", err);
    return res.status(500).json({ error: err.message });
  }
}

// simple CSV parser (minimal)
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() || ""]));
  });
}
