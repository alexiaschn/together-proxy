import { put, list, get } from "@vercel/blob";

export default async function handler(req, res) {
  // --- CORS headers ---

        res.setHeader("Access-Control-Allow-Origin", "*");  // or a specific origin
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
        if (req.method === "OPTIONS") {
          return res.status(200).end();
        }

      
        if (req.method !== "POST")
            return res.status(405).json({ error: "Method not allowed" });
        
          try {
            const newRow = req.body;
            if (!newRow) return res.status(400).json({ error: "Missing newRow" });
        
            // Get existing CSV
            const blobs = await list();
            const csvFile = blobs.blobs.find(b => b.pathname === "data.csv");
            let existing = "";
            if (csvFile) {
              const response = await get(csvFile.url);
              existing = await response.text();
            }
        
            // Append new row
            const updated = existing
              ? existing.trim() + "\n" + newRow.trim()
              : "mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment\n" +
                newRow.trim();
        
            // Save to Blob (overwrite)
            await put("data.csv", updated, {
              access: "public",
              token: process.env.BLOB_READ_WRITE_TOKEN,
              contentType: "text/csv",
            });
        
            res.status(200).json({ success: true });
          } catch (err) {
            console.error("Error updating Blob:", err);
            res.status(500).json({ error: "Failed to update CSV" });
          }
        }