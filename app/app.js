// Unified controller logic for Blinkit Discovery Insights & Chat

// State variables
let insightsData = null;
let allReviewsMap = {};
let sentimentChart = null;

// DOM Elements
const shortcutsContainer = document.getElementById("shortcuts-container");
const chatThread = document.getElementById("chat-thread");
const chatEmptyState = document.getElementById("chat-empty-state");
const clearChatBtn = document.getElementById("clear-chat-btn");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const citationDrawer = document.getElementById("citation-drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerBody = document.getElementById("drawer-body");
const drawerCloseBtn = document.getElementById("drawer-close-btn");

// Nav tab elements
const navAskBtn = document.getElementById("nav-ask-btn");
const navDashBtn = document.getElementById("nav-dash-btn");
const viewAsk = document.getElementById("view-ask");
const viewDash = document.getElementById("view-dash");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeBtnLbl = document.getElementById("theme-btn-lbl");
const syncSidebarBtn = document.getElementById("sync-data-btn");
const syncDashboardBtn = document.getElementById("refresh-data-btn");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    // Read preloaded data from window bundle
    if (window.BLINKIT_INSIGHTS) {
        insightsData = window.BLINKIT_INSIGHTS;
        initApp();
    } else {
        console.error("Blinkit insights database not found. Please run synthesise script.");
    }
    
    // Bind Tab Listeners
    navAskBtn.addEventListener("click", () => switchView("ask"));
    navDashBtn.addEventListener("click", () => switchView("dash"));
    
    // Bind listeners
    clearChatBtn.addEventListener("click", clearChat);
    searchForm.addEventListener("submit", handleSearch);
    drawerCloseBtn.addEventListener("click", closeDrawer);
    drawerOverlay.addEventListener("click", closeDrawer);
    
    // Dark mode toggle click
    themeToggleBtn.addEventListener("click", toggleDarkMode);

    // Sync button listeners
    if (syncSidebarBtn) syncSidebarBtn.addEventListener("click", syncData);
    if (syncDashboardBtn) syncDashboardBtn.addEventListener("click", syncData);
});

function initApp() {
    // Reset reviews map
    allReviewsMap = {};
    // 1. Build reviews hash map for fast ID lookup
    insightsData.questions.forEach(q => {
        q.representative_quotes.forEach(quote => {
            if (!allReviewsMap[quote.id]) {
                allReviewsMap[quote.id] = quote;
            }
        });
    });
    
    // Also add cluster representative quotes to the global map
    if (insightsData.clusters) {
        Object.keys(insightsData.clusters).forEach(key => {
            const cluster = insightsData.clusters[key];
            if (cluster.representative_reviews) {
                cluster.representative_reviews.forEach(review => {
                    if (!allReviewsMap[review.id]) {
                        allReviewsMap[review.id] = review;
                    }
                });
            }
        });
    }

    // 2. Render Shortcut Core Questions in Assistant (Spotify style: 4 default + view more)
    renderShortcuts(false);

    document.getElementById("kpi-total-reviews").textContent = insightsData.total_reviews_analyzed || "1411";
    document.getElementById("kpi-play-store").textContent = (insightsData.total_reviews_analyzed - 128) || "1283";
    document.getElementById("kpi-app-store").textContent = "15";
    document.getElementById("kpi-reddit-forums").textContent = "49";
    document.getElementById("kpi-web-search").textContent = "64";

    // 4. Render Top Pain Points Progress Bars (Sorted by size descending, all yellow)
    const painPointsContainer = document.getElementById("pain-points-container");
    painPointsContainer.innerHTML = "";
    
    const clustersList = [];
    Object.keys(insightsData.clusters).forEach(key => {
        clustersList.push(insightsData.clusters[key]);
    });
    clustersList.sort((a, b) => b.size - a.size);

    const color = "var(--brand-yellow)";

    const CLUSTER_DISPLAY_NAMES = {
        "App Navigation & Habitual Loops": "Habitual Reorder Loops & Poor Discovery",
        "Gourmet & Organic Price Markup": "Pricing & MRP Markup Complaints",
        "Fresh Produce Quality Friction": "Fresh Produce Quality & Trust Gap",
        "Fast Delivery Speed & Rider Safety": "Delivery Speed & Item Damage"
    };

    function getClusterBadge(displayName) {
        const mapping = {
            "Habitual Reorder Loops & Poor Discovery": { text: "Habit Loop", type: "amber" },
            "Pet Care Variety & Stock Issues": { text: "Exploration Barrier", type: "green" },
            "Cosmetics Authenticity & Heat Degradation": { text: "Exploration Barrier", type: "green" },
            "Diaper & Baby Care Hygiene Concerns": { text: "Exploration Barrier", type: "green" },
            "Fresh Produce Quality & Trust Gap": { text: "Exploration Barrier", type: "green" },
            "Pricing & MRP Markup Complaints": { text: "General Friction", type: "gray" },
            "Delivery Speed & Item Damage": { text: "General Friction", type: "gray" },
            "Electronics Return & Warranty Friction": { text: "General Friction", type: "gray" }
        };
        return mapping[displayName] || { text: "General Friction", type: "gray" };
    }

    clustersList.forEach((c) => {
        const displayName = CLUSTER_DISPLAY_NAMES[c.name] || c.name;
        const badge = getClusterBadge(displayName);
        const li = document.createElement("li");
        li.className = "pain-point-item";
        li.innerHTML = `
            <div class="pain-point-meta">
                <span class="pain-point-title">${displayName} <span class="cluster-badge badge-${badge.type}">${badge.text}</span></span>
                <span class="pain-point-val"><strong>${c.size} items</strong> (${c.percentage}%)</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${c.percentage}%; background-color: ${color};"></div>
            </div>
        `;
        li.addEventListener("click", () => showClusterDetails(c));
        painPointsContainer.appendChild(li);
    });

    // 5. Render Top User Needs Lists
    renderUserNeeds();
}

// Render Shortcut Core Questions in Assistant (Spotify style, only 4 by default + view more)
function renderShortcuts(showAll) {
    const shortcutsContainer = document.getElementById("shortcuts-container");
    shortcutsContainer.innerHTML = "";
    const questionsToRender = showAll ? insightsData.questions : insightsData.questions.slice(0, 4);
    
    questionsToRender.forEach(q => {
        const btn = document.createElement("button");
        btn.className = "shortcut-btn";
        btn.innerHTML = `<span class="shortcut-icon">⚡</span> <span class="shortcut-text">${q.title}</span>`;
        btn.addEventListener("click", () => triggerCoreQuestion(q));
        shortcutsContainer.appendChild(btn);
    });
    
    if (!showAll && insightsData.questions.length > 4) {
        const moreBtn = document.createElement("button");
        moreBtn.className = "shortcut-btn view-more-btn";
        moreBtn.innerHTML = `<span class="shortcut-icon">⊕</span> <span class="shortcut-text">View More Questions</span>`;
        moreBtn.addEventListener("click", () => renderShortcuts(true));
        shortcutsContainer.appendChild(moreBtn);
    }
}

// Switch between sidebar tabs
function switchView(tab) {
    if (tab === "ask") {
        navAskBtn.classList.add("active");
        navDashBtn.classList.remove("active");
        viewAsk.classList.add("active");
        viewDash.classList.remove("active");
    } else {
        navAskBtn.classList.remove("active");
        navDashBtn.classList.add("active");
        viewAsk.classList.remove("active");
        viewDash.classList.add("active");
        // Reflow sentiment chart to render properly
        if (sentimentChart) {
            sentimentChart.update();
        }
    }
}

// Render Sentiment chart
function renderSentimentChart(sentiment) {
    const ctx = document.getElementById("chart-sentiment-distribution").getContext("2d");
    if (sentimentChart) {
        sentimentChart.destroy();
    }
    
    sentimentChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Positive Mentions", "Negative Mentions", "Neutral / Context"],
            datasets: [{
                data: [sentiment.positive, sentiment.negative, sentiment.neutral],
                backgroundColor: ["#10B981", "#EF4444", "#6B7280"],
                borderWidth: 2,
                borderColor: "rgba(17, 24, 39, 0.05)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "inherit",
                        font: { family: "'Inter', sans-serif", size: 11 }
                    }
                }
            }
        }
    });
}

// Render User Needs split lists
function renderUserNeeds() {
    const discList = document.getElementById("needs-discovery-list");
    const ctrlList = document.getElementById("needs-control-list");
    
    const discoveryNeeds = [
        "Real-time stock availability check at the local dark store prior to checkout.",
        "Clear temperature safety indicators and freshness tags on cosmetics & baby care.",
        "Visual shopping lists that suggest non-grocery categories relevant to the household.",
        "Greater product breadth in premium pet supplies and regional health brands."
    ];

    const controlNeeds = [
        "Ability to disable/hide reorder history to prompt organic category discovery.",
        "Human bypass fallback option for chatbot return and refund verification loops.",
        "Transparent fee breakdown upfront (delivery fee, dark store handling charges).",
        "Rigid packaging requirements (sealed/bubble-wrapped) for sensitive infant items."
    ];

    discList.innerHTML = "";
    discoveryNeeds.forEach(need => {
        const li = document.createElement("li");
        li.textContent = need;
        discList.appendChild(li);
    });

    ctrlList.innerHTML = "";
    controlNeeds.forEach(need => {
        const li = document.createElement("li");
        li.textContent = need;
        ctrlList.appendChild(li);
    });
}

// Clear Assistant Chat Thread
function clearChat() {
    chatThread.innerHTML = "";
    chatThread.appendChild(chatEmptyState);
    chatEmptyState.style.display = "block";
    searchInput.value = "";
    viewAsk.classList.remove("chat-active");
}

// Scroll chat log to bottom
function scrollChatToBottom() {
    chatThread.scrollTop = chatThread.scrollHeight;
}

// Append User Prompt Bubble
function appendUserMessage(text) {
    chatEmptyState.style.display = "none";
    viewAsk.classList.add("chat-active");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.textContent = text;
    chatThread.appendChild(bubble);
    scrollChatToBottom();
}

// Append AI Answer Bubble
function appendAiMessage(textSummary) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble ai";
    
    bubble.innerHTML = `
        <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
        <div style="line-height: 1.6; font-size: 13.5px;">${textSummary}</div>
    `;
    
    chatThread.appendChild(bubble);
    scrollChatToBottom();
}

// Show a "thinking..." bubble, returns the bubble element so we can update it later
function showThinkingBubble() {
    chatEmptyState.style.display = "none";
    viewAsk.classList.add("chat-active");
    
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble ai";
    bubble.innerHTML = `
        <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
        <div style="font-style: italic; font-size: 13px; color: var(--text-secondary);">Thinking...</div>
    `;
    chatThread.appendChild(bubble);
    scrollChatToBottom();
    return bubble;
}

// Find top matching review verbatims from the local database
function getMatchingReviews(query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\W+/).filter(w => w.length > 2);
    
    const results = [];
    Object.keys(allReviewsMap).forEach(key => {
        const quote = allReviewsMap[key];
        const text = (quote.text || "").toLowerCase();
        let score = 0;
        queryWords.forEach(w => {
            if (text.includes(w)) score++;
        });
        if (score > 0) {
            results.push({ quote, score });
        }
    });
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5).map(r => r.quote);
}

// Call Gemini API with context reviews and user question
async function callGeminiAPI(query, contextReviews) {
    try {
        // Try calling the secure backend serverless API proxy first
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, contextReviews })
        });
        
        if (response.ok) {
            const data = await response.json();
            const answer = data.answer || "";
            const lines = answer.split("\n").map(l => l.trim()).filter(l => l.length > 0);
            return lines.slice(0, 4).join("<br>");
        }
        
        // If the serverless endpoint is not found (status 404, e.g., running static http-server locally),
        // we fall back to client-side API calls.
        if (response.status !== 404) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${response.status}`);
        }
    } catch (apiErr) {
        console.warn("Secure backend API unavailable, attempting client-side fallback...", apiErr);
    }

    // Client-side fallback (useful for local static dev servers like http-server)
    let apiKey = window.CHATBOT_API_KEY || localStorage.getItem("GEMINI_CHAT_API_KEY") || new URLSearchParams(window.location.search).get("key");
    if (!apiKey) {
        const userKey = prompt("To enable the AI Chatbot, please paste your Gemini API Key (saved securely in your browser's local storage):");
        if (userKey && userKey.trim()) {
            localStorage.setItem("GEMINI_CHAT_API_KEY", userKey.trim());
            apiKey = userKey.trim();
        } else {
            throw new Error("No chatbot API key configured.");
        }
    }
    
    const reviewsText = contextReviews.map((r, i) => 
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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
        throw new Error(errData.error?.message || `API error ${response.status}`);
    }
    
    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lines = answer.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    return lines.slice(0, 4).join("<br>");
}

// Trigger core preset question — now uses LLM
function triggerCoreQuestion(q) {
    appendUserMessage(q.title);
    const bubble = showThinkingBubble();
    
    const contextReviews = getMatchingReviews(q.title);
    
    callGeminiAPI(q.title, contextReviews).then(answer => {
        bubble.innerHTML = `
            <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
            <div style="line-height: 1.6; font-size: 13.5px;">${answer}</div>
        `;
        scrollChatToBottom();
    }).catch(err => {
        console.error("Gemini API error, falling back to static:", err);
        // Fallback to static answer
        bubble.innerHTML = `
            <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
            <div style="line-height: 1.6; font-size: 13.5px;">${q.summary}</div>
        `;
        scrollChatToBottom();
    });
}

// Handle Custom queries via RAG + LLM
function handleSearch(e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    appendUserMessage(query);
    searchInput.value = "";
    
    const bubble = showThinkingBubble();
    const contextReviews = getMatchingReviews(query);
    
    callGeminiAPI(query, contextReviews).then(answer => {
        bubble.innerHTML = `
            <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
            <div style="line-height: 1.6; font-size: 13.5px;">${answer}</div>
        `;
        scrollChatToBottom();
    }).catch(err => {
        console.error("Gemini API error:", err);
        bubble.innerHTML = `
            <div style="font-weight: 700; color: var(--logo-accent-color); font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">AI Assistant Response</div>
            <div style="line-height: 1.6; font-size: 13.5px;">Sorry, I couldn't generate a response right now. Please try again.</div>
        `;
        scrollChatToBottom();
    });
}

// Drawer Details popup
function openCitationDrawer(id) {
    const review = allReviewsMap[id];
    if (!review) return;

    let ratingStars = "";
    if (review.rating) {
        for (let i = 1; i <= 5; i++) {
            ratingStars += i <= review.rating ? "★" : "☆";
        }
    } else {
        ratingStars = "Rating: N/A";
    }

    drawerBody.innerHTML = `
        <div class="drawer-review-card">
            <div class="review-meta">
                <span class="review-author">${review.author || "Anonymous user"}</span>
                <span class="review-source">${review.source}</span>
            </div>
            <div class="review-stars">${ratingStars}</div>
            <div class="review-date">${review.date ? review.date.split('T')[0] : "Date: N/A"}</div>
            
            <div style="margin-top: 16px;">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Original Review Text:</div>
                <div class="review-text" style="font-size: 14px; line-height: 1.6; color: var(--text-primary); font-style: italic;">"${review.text}"</div>
            </div>
            
            ${review.translated_text ? `
            <div style="margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 12px;">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">English Translation (Hinglish):</div>
                <div class="review-text" style="font-size: 14px; line-height: 1.6; color: var(--logo-accent-color); font-weight: 500;">"${review.translated_text}"</div>
            </div>
            ` : ""}
            
            ${review.permalink_or_url ? `
            <div style="margin-top: 20px;">
                <a href="${review.permalink_or_url}" target="_blank" class="review-link" style="color: var(--logo-accent-color); text-decoration: none; font-size: 12px; font-weight: 600;">View original post/source &rarr;</a>
            </div>
            ` : ""}
        </div>
    `;

    citationDrawer.classList.add("open");
    drawerOverlay.classList.add("open");
}

function showClusterDetails(c) {
    const CLUSTER_DISPLAY_NAMES = {
        "App Navigation & Habitual Loops": "Habitual Reorder Loops & Poor Discovery",
        "Gourmet & Organic Price Markup": "Pricing & MRP Markup Complaints",
        "Fresh Produce Quality Friction": "Fresh Produce Quality & Trust Gap",
        "Fast Delivery Speed & Rider Safety": "Delivery Speed & Item Damage"
    };
    const displayName = CLUSTER_DISPLAY_NAMES[c.name] || c.name;
    // Collect representatives
    let repsHtml = `<div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: var(--logo-accent-color);">${displayName}</div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">${c.summary}</div>
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-bottom: 12px;">Representative Verbatims:</div>`;
    
    // Slice to exactly 1-2 representative reviews
    const reviews = (c.representative_reviews || []).slice(0, 2);
    if (reviews.length === 0) {
        repsHtml += `<p style="font-size: 12px; color: var(--text-secondary); font-style: italic;">No representative reviews indexed for this segment.</p>`;
    } else {
        reviews.forEach((r, idx) => {
            repsHtml += `
                <div class="drawer-verbatim-card">
                    "${r.text}"
                </div>
            `;
            // Cache it
            allReviewsMap[r.id] = r;
        });
    }

    drawerBody.innerHTML = repsHtml;
    citationDrawer.classList.add("open");
    drawerOverlay.classList.add("open");
}

function closeDrawer() {
    citationDrawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
}

// Toggle layout theme (Dark/Light mode)
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    if (document.body.classList.contains("dark-mode")) {
        themeBtnLbl.textContent = "Light Mode";
    } else {
        themeBtnLbl.textContent = "Dark Mode";
    }
}

// Dynamically inject updated data.js script tag to reload insightsData (cache-busted)
function loadLatestData() {
    return new Promise((resolve, reject) => {
        const oldScript = document.querySelector('script[src^="data.js"]');
        if (oldScript) {
            oldScript.remove();
        }
        const script = document.createElement('script');
        script.src = 'data.js?t=' + Date.now();
        script.onload = () => {
            if (window.BLINKIT_INSIGHTS) {
                resolve(window.BLINKIT_INSIGHTS);
            } else {
                reject(new Error("Failed to load BLINKIT_INSIGHTS from dynamic script."));
            }
        };
        script.onerror = () => reject(new Error("Network error loading dynamic script."));
        document.body.appendChild(script);
    });
}

// Success Toast alert generator
function showToast(message) {
    const existing = document.querySelector(".sync-toast");
    if (existing) {
        existing.remove();
    }
    const toast = document.createElement("div");
    toast.className = "sync-toast";
    toast.innerHTML = `
        <svg style="width:18px;height:18px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "none";
        toast.offsetHeight; // reflow
        toast.style.animation = "slideUpFade 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Dynamic Sync Logic
async function syncData() {
    // 1. Show loading state on buttons
    const sidebarIcon = document.getElementById("sync-icon");
    if (syncSidebarBtn) syncSidebarBtn.classList.add("loading");
    if (syncDashboardBtn) {
        syncDashboardBtn.classList.add("loading");
        syncDashboardBtn.textContent = "Syncing...";
    }

    try {
        // 2. Load latest data.js (cache-busted)
        const freshData = await loadLatestData();
        
        // 3. Re-assign model state variables
        insightsData = freshData;
        
        // 4. Reset UI components
        initApp();
        
        // 5. Success feedback
        showToast("Insights synced with latest database!");
    } catch (err) {
        console.error("Data Sync Error:", err);
        showToast("Error: Failed to sync latest insights data.");
    } finally {
        // 6. Reset loading state on buttons
        if (syncSidebarBtn) syncSidebarBtn.classList.remove("loading");
        if (syncDashboardBtn) {
            syncDashboardBtn.classList.remove("loading");
            syncDashboardBtn.textContent = "Refresh Data";
        }
    }
}

