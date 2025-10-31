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

    // 3️⃣ Filter relevant pages
    let relevantPages = dictionary.filter(entry =>
      selectedPages.includes(entry["page-title"])
    );

    // 🧮 4️⃣ Token budgeting: limit total context size dynamically
    const TOKEN_BUDGET = 7000; // safe limit under Together free models
    let totalTokens = 0;
    const limitedPages = [];

    for (const page of relevantPages) {
      const pageText = (page.fr || []).join(", ");
      const pageTokens = estimateTokens(pageText);
      if (totalTokens + pageTokens > TOKEN_BUDGET) break;
      totalTokens += pageTokens;
      limitedPages.push(page);
    }

    console.log(`🧠 Selected ${limitedPages.length} pages within ${totalTokens} token budget:`);
    console.log(limitedPages.map(p => p["page-title"]).join(", "));

    // 5️⃣ Translate keyword using the limited pages
    const translation = await translateKeywordToIEML(keyword, limitedPages);

    return res.status(200).json({
      keyword,
      pages: limitedPages.map(p => p["page-title"]),
      translation,
      token_estimate: totalTokens,
    });

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
  const model = "google/gemma-3n-E4B-it";
  const prompt = `IEML est un langage qui permet de décomposer sémantiquement un concept à partir des aspects "mot,theme,qui,quoi,à qui,par quoi,quand,où,pourquoi,comment".
   Un concept ne peut être décomposé qu'à partir des mots déjà traduits en IEML et présents dans le dictionnaire. 
   Pour traduire le mot-clé "${keyword}" en IEML tu auras besoin du vocabulaire présent dans certaines pages du dictionnaire IEML.
   Sélectionne au maximum 10 pages pertinentes dans la liste suivante.
   Répond uniquement avec leurs titres exacts (page-title), séparés par des virgules.

   Liste des pages disponibles:
   [Functional roles, Primitives, Technical functions, Human development, Operations, Actions & agents, Disciplines & their objects, ... etc.]`;

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

// 🔹 Estimate number of tokens (approx.)
function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).length / 0.75); // rough 1 token ≈ 0.75 words
}

// 🔹 Phase 2: translation
async function translateKeywordToIEML(keyword, pageData) {
  // const model = "google/gemma-3n-E4B-it";
  const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";
  const context = pageData.map(p =>
    `### ${p["page-title"]}
Mots-concepts: ${p.fr.join(", ")}`
  ).join("\n\n");

  const prompt = `Tu es un agent traducteur IEML. 
Tu disposes des pages suivantes du dictionnaire IEML pour traduire le mot "${keyword}":  

${context}

Traduis le mot-clé "${keyword}" en IEML sous la forme :
mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment.
Répond uniquement avec la ligne CSV finale, sans explication.`;

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
  console.log("🗣️ Together raw response:", JSON.stringify(data, null, 2));

  return data.choices?.[0]?.message?.content?.trim() || "";
}
