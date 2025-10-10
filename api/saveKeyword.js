import { Blob } from "@vercel/blob";

export default async function handler(req, res) {
  // --- CORS headers ---

        res.setHeader("Access-Control-Allow-Origin", "*");  // or a specific origin
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
        if (req.method === "OPTIONS") {
          return res.status(200).end();
        }
          try {
            // Instantiate a Blob client with env variables
            const blob = new Blob({
              url: process.env.BLOB_REST_API_URL,
              token: process.env.BLOB_REST_API_TOKEN,
            });
        
            // Retrieve the CSV file
            const csvFile = await blob.get("data.csv");  // <-- key is the file name
            let existing = "";
            if (csvFile) {
              existing = await csvFile.text();  // fetch content
            }
        
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
        
            // Upload updated CSV back to Blob
            await blob.put("data.csv", updatedCSV, { contentType: "text/csv" });
        
            return res.status(200).json({ success: true, row: newRow });
          } catch (err) {
            console.error("Error updating Blob:", err);
            return res.status(500).json({ error: "Failed to update CSV" });
          }
        }
        