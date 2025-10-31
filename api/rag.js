// api/rag
import { list } from "@vercel/blob";

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

  const keyword = req.query.keyword;
  if (!keyword) {
    return res.status(400).json({ error: "Missing keyword parameter" });
  }

  try {
    console.log(`🔍 Starting IEML translation pipeline for: ${keyword}`);

    // 1️⃣ Select pages using the LLM
    const selectedPages = await selectPagesForKeyword(keyword);
    console.log("📄 Selected pages:", selectedPages);

    // 2️⃣ Fetch dictionary JSON blob from Vercel storage
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === "ieml_dictionary_4_vercel.json");
    if (!blob) {
      return res.status(404).json({ error: "ieml_dictionary_4_vercel.json not found" });
    }

    const response = await fetch(blob.url);
    const dictionary = await response.json();

    // 3️⃣ Filter the relevant pages
    const pageData = dictionary.filter(entry =>
      selectedPages.includes(entry["page-title"])
    );
    console.log("📘 Retrieved pages:", pageData.map(p => p["page-title"]));

    // 4️⃣ Translate keyword using the pages as context
    const translation = await translateKeywordToIEML(keyword, pageData);

    return res.status(200).json({ keyword, pages: selectedPages, translation });

  } catch (err) {
    console.error("❌ Error in IEML agent handler:", err);
    return res.status(500).json({ error: err.message });
  }
}

//
// ===== Helper Functions =====
//

// 🔹 Phase 1: choose pages
async function selectPagesForKeyword(keyword) {
  const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";

  const prompt = `IEML est un langage ... [ton texte inchangé] ...
De quelles pages as-tu besoin pour traduire "${keyword}" ?
Répond uniquement avec les titres exacts des pages (page-title) séparés par des virgules.`;

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Together API error in page selection:", text);
    return [];
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  return text.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
}

// 🔹 Phase 2: translation
async function translateKeywordToIEML(keyword, pageData) {
  const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";

  const context = pageData.map(p =>
    `### ${p["page-title"]}
Français: ${p.fr.join(", ")}
Anglais: ${p.en.join(", ")}`
  ).join("\n\n");

  const prompt = `Tu es un agent traducteur IEML. 
Tu disposes des pages suivantes du dictionnaire IEML : 

${context}

Traduis le mot-clé "${keyword}" en IEML sous la forme :
mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment
Donne uniquement la ligne de traduction, sans texte supplémentaire.`;

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Together API error in translation:", text);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
