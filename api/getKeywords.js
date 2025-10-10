import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    // 1️⃣ List all keys with prefix "keyword:"
    const keys = await kv.keys("keyword:*");

    // 2️⃣ Fetch all values
    const allRows = [];
    for (const key of keys) {
      const value = await kv.get(key);
      if (value) allRows.push(JSON.parse(value));
    }

    return res.status(200).json(allRows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch keywords" });
  }
}
