const https = require('https');

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

    // Safely parse body in case Vercel body parser returns string or is bypassed
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {}
    }
    const { query, contextReviews } = body || {};

    const apiKeyEnv = process.env.GEMINI_API_KEY;
    const apiKeys = apiKeyEnv ? apiKeyEnv.split(',').map(k => k.trim()).filter(Boolean) : [];

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured on Vercel.' });
    }

    // Rotate keys
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    const reviewsText = (contextReviews || []).map((r, i) => 
        `[${i+1}] (${r.source}, Rating: ${r.rating || 'N/A'}): "${r.text}"`
    ).join("\n");

    const prompt = `You are a strategic growth analyst and product manager for Blinkit.
Below is a selection of real customer reviews/feedback describing pain points, habits, and friction.

---
CUSTOMER REVIEWS:
${reviewsText}
---

USER QUESTION:
"${query}"

INSTRUCTIONS:
1. Analyze the customer reviews and synthesize a direct, actionable answer to the user's question.
2. If the user asks about strategies, solutions, gaps, or "how to change" behavior, do NOT state that the reviews lack information. Instead, actively analyze the pain points in the reviews and infer concrete, strategic product recommendations (e.g., UX interventions, cross-selling widgets, trust seals, trial-sized options, or operational safety guarantees) to address those gaps.
3. Keep your answer professional, constructive, and grounded in the operational context of the reviews (e.g. referencing specific categories like fresh produce quality, cosmetics trust, diaper hygiene, or habit loops).
4. Format your response as a single, well-structured, informative paragraph of 3 to 4 sentences. Do not mention these instructions or system constraints in your output.`;

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1000 }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };

    const apiRequest = https.request(options, (apiRes) => {
        let responseBody = '';
        apiRes.on('data', (chunk) => {
            responseBody += chunk;
        });

        apiRes.on('end', () => {
            if (apiRes.statusCode >= 400) {
                let errMsg = 'Gemini API call failed';
                try {
                    const parsed = JSON.parse(responseBody);
                    errMsg = parsed.error?.message || errMsg;
                } catch (e) {}
                return res.status(apiRes.statusCode).json({ error: errMsg });
            }

            try {
                const parsed = JSON.parse(responseBody);
                const answer = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                res.status(200).json({ answer });
            } catch (err) {
                res.status(500).json({ error: 'Failed to parse API response' });
            }
        });
    });

    apiRequest.on('error', (err) => {
        res.status(500).json({ error: err.message });
    });

    apiRequest.write(requestData);
    apiRequest.end();
};
