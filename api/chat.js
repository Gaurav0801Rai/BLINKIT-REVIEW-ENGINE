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
    const { query, contextReviews, clientApiKey } = body || {};

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

    // Prioritize server environment variables, fallback to client-forwarded keys
    const groqApiKey = process.env.GROQ_API_KEY || (clientApiKey && clientApiKey.startsWith("gsk_") ? clientApiKey : null);
    
    // 1. Prioritize Groq if a Groq key is configured
    if (groqApiKey) {
        try {
            const result = await makeGroqRequest(groqApiKey, prompt);
            if (result.statusCode === 200) {
                const parsed = JSON.parse(result.body);
                const answer = parsed.choices?.[0]?.message?.content || "";
                return res.status(200).json({ answer });
            } else {
                console.warn(`Groq request failed with status ${result.statusCode}: ${result.body}`);
            }
        } catch (err) {
            console.error("Groq request error:", err);
        }
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
