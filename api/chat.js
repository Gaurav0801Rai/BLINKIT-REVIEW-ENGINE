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

    // Manually read stream chunks to construct the request body in case Vercel body parser fails or is bypassed
    let requestBody = '';
    if (req.body) {
        requestBody = req.body;
    } else {
        requestBody = await new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { resolve(data); });
        });
    }

    let payload = {};
    if (typeof requestBody === 'object') {
        payload = requestBody;
    } else if (typeof requestBody === 'string' && requestBody.trim().length > 0) {
        try {
            payload = JSON.parse(requestBody);
        } catch (e) {
            console.error("JSON parsing error on request body:", e);
        }
    }

    const { query, contextReviews, clientApiKey } = payload || {};

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
1. Synthesize a direct, concise, and actionable answer to the user's question by analyzing the customer reviews.
2. If the user asks about strategies, solutions, or gaps, actively infer concrete product recommendations (e.g., UX changes, cross-selling, quality badges, or packaging seals) instead of stating that the reviews lack data.
3. Keep your response brief and to the point: explain the main customer friction issue and the proposed PM solution in a single paragraph of exactly 2 to 3 sentences (aim for 50-70 words total). Do not include any greeting or conversational filler.`;

    const serverGroqKey = process.env.GROQ_API_KEY;
    const clientGroqKey = clientApiKey && clientApiKey.startsWith("gsk_") ? clientApiKey : null;
    
    const groqKeys = Array.from(new Set([serverGroqKey, clientGroqKey].map(k => k ? k.trim() : null).filter(Boolean)));
    
    let groqSuccess = false;
    let groqAnswer = "";
    let groqError = null;
    
    // 1. Try Groq keys one by one (server key first, then client key fallback)
    for (const key of groqKeys) {
        try {
            const result = await makeGroqRequest(key, prompt);
            if (result.statusCode === 200) {
                const parsed = JSON.parse(result.body);
                groqAnswer = parsed.choices?.[0]?.message?.content || "";
                groqSuccess = true;
                break;
            } else {
                console.warn(`Groq request failed with status ${result.statusCode} for key: ${key.substring(0, 10)}...: ${result.body}`);
                groqError = { statusCode: result.statusCode, body: result.body, keyPreview: key.substring(0, 10) };
            }
        } catch (err) {
            console.error("Groq request error:", err);
            groqError = { statusCode: 500, body: err.message, keyPreview: key.substring(0, 10) };
        }
    }
    
    if (groqSuccess) {
        return res.status(200).json({ answer: groqAnswer });
    }
    
    // If Groq was attempted but failed, check if we should bubble up the 401 Invalid Key error
    if (groqKeys.length > 0 && groqError && groqError.statusCode === 401) {
        return res.status(401).json({
            error: `Groq API returned status 401 (Invalid API Key). Key tried: ${groqError.keyPreview}...`,
            details: groqError.body
        });
    }

    // 2. Fall back to Gemini Key Rotation
    const apiKeyEnv = process.env.GEMINI_API_KEY || (clientApiKey && !clientApiKey.startsWith("gsk_") ? clientApiKey : null);
    const apiKeys = apiKeyEnv ? apiKeyEnv.split(',').map(k => k.trim()).filter(Boolean) : [];

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on Vercel.' });
    }

    const requestData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1000 }
    });

    let responseBody = '';
    let success = false;
    let lastError = 'API calls failed due to rate limits or quota depletion';
    let statusCode = 500;

    const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);

    for (const apiKey of shuffledKeys) {
        try {
            const result = await makeGeminiRequest(apiKey, requestData);
            statusCode = result.statusCode;
            responseBody = result.body;
            
            if (statusCode === 200) {
                success = true;
                break;
            } else {
                try {
                    const parsed = JSON.parse(responseBody);
                    lastError = parsed.error?.message || lastError;
                } catch (e) {}
            }
        } catch (err) {
            lastError = err.message;
        }
    }

    if (!success) {
        return res.status(statusCode).json({ error: lastError });
    }

    // Parse successful response
    try {
        const parsed = JSON.parse(responseBody);
        const answer = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.status(200).json({ answer });
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse API response' });
    }
};

// Helper function to make the HTTPS request to Groq API
function makeGroqRequest(apiKey, promptText) {
    const requestData = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: promptText }],
        temperature: 0.4,
        max_tokens: 500
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => { body += chunk; });
            apiRes.on('end', () => {
                resolve({ statusCode: apiRes.statusCode, body });
            });
        });

        apiRequest.on('error', (err) => {
            reject(err);
        });

        apiRequest.write(requestData);
        apiRequest.end();
    });
}

// Helper function to make the HTTPS request to Gemini API
function makeGeminiRequest(apiKey, requestData) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => { body += chunk; });
            apiRes.on('end', () => {
                resolve({ statusCode: apiRes.statusCode, body });
            });
        });

        apiRequest.on('error', (err) => {
            reject(err);
        });

        apiRequest.write(requestData);
        apiRequest.end();
    });
}
