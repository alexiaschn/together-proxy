import { put, get } from "@vercel/blob";
import crypto from "crypto";

// Enable CORS for browser extensions
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
    // --- Retrieve existing logs ---
    let existingLogs = [];
    const existing = await get(blobName).catch(() => null);

    if (existing?.url) {
      const file = await fetch(existing.url);
      existingLogs = await file.json().catch(() => []);
    }

    if (req.method === "POST") {
      const { logs, userId } = req.body;

      if (!Array.isArray(logs)) {
        return res.status(400).json({ error: "Body must include an array 'logs'" });
      }

      // Generate a new userId if not provided
      const id = userId || crypto.randomUUID();

      // Append new session entry
      const newSession = {
        userId: id,
        timestamp: new Date().toISOString(),
        logs,
      };

      const updatedLogs = [...existingLogs, newSession];

      await put(blobName, JSON.stringify(updatedLogs, null, 2), {
        access: "public",
        contentType: "application/json",
      });

      return res.status(200).json({
        success: true,
        userId: id,
        totalSessions: updatedLogs.length,
      });
    }

    if (req.method === "GET") {
      return res.status(200).json(existingLogs);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in saveKeptLogs:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
