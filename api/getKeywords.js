import { list, get } from "@vercel/blob";

export default async function handler(req, res) {

        res.setHeader("Access-Control-Allow-Origin", "*");  // or a specific origin
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
        if (req.method === "OPTIONS") {
          return res.status(200).end();
        }
        try {
          // Find the latest uploaded CSV
          const blobs = await list();
          const csvFile = blobs.blobs.find(b => b.pathname === "data.csv");
          if (!csvFile) {
            return res.status(200).json({ text: "" });
          }
      
          const response = await get(csvFile.url);
          const text = await response.text();
      
          res.status(200).json({ text });
        } catch (err) {
          console.error("Error fetching from Blob:", err);
          res.status(500).json({ error: "Failed to load CSV" });
        }
      }