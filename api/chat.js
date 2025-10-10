// api/chat.js (Vercel serverless function)
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

  const keyword = req.body?.keyword;
  if (!keyword) {
    return res.status(400).json({ error: "Missing keyword in request body" });
  }

  if (!process.env.TOGETHER_API_KEY) {
    console.error("Missing TOGETHER_API_KEY environment variable!");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";
  const prompt = `Décompose sémantiquement le mot-clé "${keyword}" dans un CSV avec ces valeurs :
mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment
Suit les exemples suivants:
arts plastiques,transformer,~plusieurs art,matériau,,,,,,
autochtone,~voix passive situer,communauté,,,,antériorité,,,,
première nation,~voix passive situer,communauté,,,,antériorité,,,,
C'est à ton tour avec le mot-clé : "${keyword}".`;

  try {
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
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
