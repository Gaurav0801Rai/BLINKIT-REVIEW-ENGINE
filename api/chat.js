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

    const prompt = `You are a helpful customer research assistant analyzing reviews for Blinkit.
Below are relevant customer reviews to help answer the question.

---
CUSTOMER REVIEWS:
${reviewsText}
---

USER QUESTION:
"${query}"

INSTRUCTIONS:
1. Provide a direct, specific answer to the user's question using the customer reviews provided.
2. If the reviews don't cover the topic, state that clearly in 1-2 lines.
3. Keep your response brief, informative, and formatted as a single clear paragraph of 3-4 sentences. Do not mention any prompt constraints or formatting instructions in your output.`;

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
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
