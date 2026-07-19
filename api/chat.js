module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query, contextReviews } = req.body;
    
    // Support multiple comma-separated keys rotation in server environment variables
    const apiKeyEnv = process.env.GEMINI_API_KEY;
    const apiKeys = apiKeyEnv ? apiKeyEnv.split(',').map(k => k.trim()).filter(Boolean) : [];

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured on the server.' });
    }

    // Select a key randomly or sequentially based on timestamp to distribute load
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    const reviewsText = (contextReviews || []).map((r, i) => 
        `[${i+1}] (${r.source}, Rating: ${r.rating || 'N/A'}): "${r.text}"`
    ).join("\n");

    const prompt = `You are the Blinkit Growth Insights AI assistant. A user is asking about customer feedback.

User question: "${query}"

Here are real customer reviews/feedback relevant to this question:
${reviewsText}

Instructions:
- Answer in EXACTLY 3 to 4 lines. No more.
- Be specific — reference actual complaints or praise from the reviews.
- Do NOT repeat the question. Just answer directly.
- If reviews don't cover the topic, say so briefly in 2 lines.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: errData.error?.message || 'Gemini API call failed' });
        }

        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.status(200).json({ answer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
