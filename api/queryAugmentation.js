// api/queryAugmentation
export default async function handler(req, res) {
    // --- CORS headers ---
    res.setHeader("Access-Control-Allow-Origin", "*"); // For tighter security, restrict to your extension origin
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    const keywords = req.body?.keywords;
    if (!keywords) {
      return res.status(400).json({ error: "Missing keywords in request body" });
    }
  
    if (!process.env.TOGETHER_API_KEY) {
      console.error("Missing TOGETHER_API_KEY environment variable!");
      return res.status(500).json({ error: "Server misconfigured" });
    }
  
    const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";
    const promptGenerateVariants = `Produit 10 variants de la requête booléenne suivante "${keywords}". Combine les requêtes proposées à l'aide de l'opérateur OU comme dans l'exemple : Mots-clés:  "impact of climate change on biodiversity". Réponse: "
    (climate change biodiversity impact) OU (effects of climate change on ecosystems) OU (biodiversity loss due to climate change) OU (climate change species extinction) OU (impact of global warming on wildlife) OU (effects of climate change on ecosystems and species diversity) OU (how climate change impacts wildlife and biodiversity) OR (climate change consequences for biological diversity) OU (relationship between climate change and loss of biodiversity) OU (climate change threats to flora and fauna diversity) OU (impact of climate change on biodiversity)
    C'est à ton tour avec "${keywords}". Répond uniquement avec la requête sans donner d'explication.`
    try {
      const response = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: promptGenerateVariants }],
        }),
      });
  
      if (!response.ok) {
        const text = await response.text();
        console.error("Together API error:", text);
        return res.status(response.status).json({ error: text });
      }
  
      const data = await response.json();
      // Extract the text content
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ text });
  
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  }
  