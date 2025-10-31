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

  const prompt = `IEML est un langage qui permet de décomposer sémantiquement un concept à partir des aspects "mot,theme,qui,quoi,à qui,par quoi,quand,où,pourquoi,comment".
   Un concept ne peut être décomposé qu'à partir des mots déjà traduits en IEML et présents dans le dictionnaire. Pour traduire le mot-clé "${keyword}" en IEML tu auras du vocabulaire présents dans certaines pages du dictionnaire IEML.
   Choisis les pages dont tu as besoin pour ta traduction. 
   Exemples de mots-clés traduits en IEML:
   "mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment 
   arts plastiques,transformer,~plusieurs art,matériau,,,,,, 
   théorie de la littérature,théorie,,littérature,,,,,, 
   théorie musico-littéraire,théorie,,littérature &et musique,,,,,,
   littératie visuelle numérique,compétence,,culture visuelle,,,,,*dans le contexte de technique numérique, 
   didactique de la lecture numérique,enseignement,,lire,,*par le moyen de technique numérique,,,,*avec méthode" 
   
   Liste des pages disponibles: nb_mots_,page-title
    14,Functional roles
1,Indications
22,Primitives,symmetry
221,Technical functions
13,Climates
119,Human development
12,Interaction,symmetry
1,links for auxiliaries of place
39,Nature's layers
35,Operations
62,Physical movement & action
15,Time units - Calendar
40,Actions & agents,symmetry
169,Basic qualities
15,Landscapes
1,links for Human development (M_M_.O_M
24,Sky & meteorology
42,Symmetries
15,Tme units - Chronometer
34,Weight,pressure,alternance
25,Animals & plants
13,Cardinals
12,Continents and regions
33,Human experience,sym
11,Moments of the day
17,Movements in environments
251,Values
26,causation
12,Oceans and seas
13,Ordinals
20,Orientation in time
16,Parts of plants
48,Sensori-motor exp. & control
10,North America
26,Proportions
16,time
33,Time and movement
10,Central America & Caribbean
45,Life cycles
38,place
20,Continuities & discontinuities
44,intention
10,South America
10,Europe
51,Generative mutations
20,manner
10,Southern Africa
10,Asia
10,South Asia
10,Oceania
59,Anthropological functions
15,Arms and Legs
20,Causatives
13,Collective intelligence hexad
55,Colors
6,Commutative junctions
249,Competencies & their objects
81,Complex feelings
18,Composition qualities
86,Conditions for activity
22,Cutting tools
19,Data curation & critical thinking
251,Disciplines & their objects
1,doc_name
15,Documentation metadata
19,Genders
16,Geometrical concepts
56,Geometrical figures
63,Gradients
7,Grammatical persons
17,Hands and Feet
41,History and Cultural forms
47,Inflections for nouns
54,Inflections for verbs
19,Knowledge qualities
30,Layers of symbolic cognition
19,Lifting,throwing,piercing
115,Negativity
118,Noetic categories
27,Non commutative junctions
139,Obstacles
18,Opposition qualities
77,Performative acts
22,Personality types
38,Philosophical dialectics
19,Plus and minus qualities
70,Positions & objects in space
18,Possession hexad
25,Rational inquiry
19,Relationship qualities
49,School years or grade levels
27,Shapes & look
244,Signs & semiotic functions
28,Size
340,Social roles & institutions
10,Solids,construction
15,Textile
17,Tools to gather and hold
21,Trunk and Head

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
Français: ${p.fr.join(", ")}`
  ).join("\n\n"); // suppr anglais pour réduire input size

  const prompt = `Tu es un agent traducteur IEML. 
Tu disposes des pages suivantes du dictionnaire IEML : 

${context}

Traduis le mot-clé "${keyword}" en IEML sous la forme :
mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment. 
Exemples de mots-clés traduits en IEML:
   "mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment 
   arts plastiques,transformer,~plusieurs art,matériau,,,,,, 
   théorie de la littérature,théorie,,littérature,,,,,, 
   théorie musico-littéraire,théorie,,littérature &et musique,,,,,,
   littératie visuelle numérique,compétence,,culture visuelle,,,,,*dans le contexte de technique numérique, 
   didactique de la lecture numérique,enseignement,,lire,,*par le moyen de technique numérique,,,,*avec méthode" 
Donne uniquement la ligne CSV finale,correspondant au mot-clé "${keyword}", sans explication, ni avant ni après.`;

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
  console.log("Together raw response:", JSON.stringify(data, null, 2));

  return data.choices?.[0]?.message?.content?.trim() || "";
}
