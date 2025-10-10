import { list, put } from "@vercel/blob";

export default async function handler(req, res) {
  // --- CORS headers ---

        res.setHeader("Access-Control-Allow-Origin", "*");  // or a specific origin
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
        if (req.method === "OPTIONS") {
          return res.status(200).end();
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
                const existing = await response.text();
            
        
            // Append new row
            const newRow = req.body;
            const header = "mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment";
            let updatedCSV = existing.trim() ? existing + "\n" : header + "\n";
            updatedCSV += [
              newRow.mot,
              newRow.theme,
              newRow.qui,
              newRow.quoi,
              newRow.a_qui,
              newRow.par_quoi,
              newRow.quand,
              newRow.ou,
              newRow.pourquoi,
              newRow.comment
            ].join(",");
        
            // Upload updated CSV
            await put("data.csv", updatedCSV, { contentType: "text/csv" });
        
            return res.status(200).json({ success: true, row: newRow });
          } catch (err) {
            console.error("Error updating Blob:", err);
            console.log(updatedCSV)
            return res.status(500).json({ error: "Failed to update CSV" });
          }
        }
        