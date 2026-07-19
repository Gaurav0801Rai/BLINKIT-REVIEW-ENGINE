import os
import json
import logging
import re
from typing import List, Dict, Any
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Load local environment variables from .env
load_dotenv()

# Dictionary map for basic rule-based translation fallback of Hinglish reviews
HINGLISH_TRANSLATION_MAP = {
    "bohot": "very",
    "bahut": "very",
    "nhi": "not",
    "nahi": "not",
    "hai": "is",
    "h": "is",
    "bhaiya": "brother",
    "bhai": "brother",
    "sabzi": "vegetables",
    "sabji": "vegetables",
    "khareedna": "buying",
    "mangaya": "ordered",
    "paise": "money",
    "rupaye": "rupees",
    "kharab": "spoiled/bad",
    "bekar": "useless/bad",
    "badhiya": "great",
    "acha": "good",
    "achha": "good",
    "accha": "good",
    "jaldi": "fast",
    "aaj": "today",
    "kal": "tomorrow",
    "chahiye": "should/need",
    "aur": "and",
    "pe": "on",
    "par": "on",
    "bhi": "also",
    "lekin": "but",
    "kyu": "why",
    "kyun": "why"
}

def rule_based_translate(text: str) -> str:
    # Basic word replacement for fallback Hinglish translation
    words = text.split()
    translated_words = []
    for w in words:
        clean_w = re.sub(r'[^\w]', '', w).lower()
        if clean_w in HINGLISH_TRANSLATION_MAP:
            # Replace word preserving punctuation if possible
            replacement = HINGLISH_TRANSLATION_MAP[clean_w]
            translated_words.append(w.lower().replace(clean_w, replacement))
        else:
            translated_words.append(w)
    return " ".join(translated_words)

def rule_based_enrich(text: str, rating: Any, lang: str) -> Dict[str, Any]:
    text_lower = text.lower()
    
    # 1. Topic Heuristics
    topic = "other"
    if any(w in text_lower for w in ["delivery", "rider", "speed", "mins", "min", "time", "fast", "slow", "delivering"]):
        topic = "delivery"
    if any(w in text_lower for w in ["vegetable", "fruits", "onion", "tomato", "fresh", "stale", "rotten", "greens", "apple", "mango", "spinach", "coriander", "sabzi", "sabji"]):
        topic = "fresh-produce"
    if any(w in text_lower for w in ["ui", "app", "search", "muscle", "habit", "reorder", "re-order", "screen", "button", "click", "banner", "layout", "filter"]):
        topic = "app-ux"
    if any(w in text_lower for w in ["price", "charge", "mrp", "discount", "coupon", "expensive", "fee", "cost", "rupees", "paise"]):
        topic = "pricing"
    if any(w in text_lower for w in ["fake", "expired", "expiry", "tampered", "seal", "warranty", "trust", "hygiene", "dust", "rotten", "mold", "sour", "smell", "unhygienic", "cleanliness"]):
        topic = "trust"
    if any(w in text_lower for w in ["did not know", "didn't know", "discover", "explorer", "find", "explore", "exploring"]):
        topic = "discovery"

    # 2. Categories Mentioned Heuristics
    categories = []
    if any(w in text_lower for w in ["dog", "cat", "pet", "kibble", "royal canin", "whiskas", "supertails"]):
        categories.append("pet-care")
    if any(w in text_lower for w in ["baby", "diaper", "formula", "pampers", "infant", "sebamed", "mustela", "firstcry"]):
        categories.append("baby-care")
    if any(w in text_lower for w in ["shampoo", "cleanser", "sunscreen", "cosmetics", "makeup", "cetaphil", "neutrogena", "biotique", "skin", "face", "beauty", "hair", "lipstick"]):
        categories.append("personal-care")
    if any(w in text_lower for w in ["charger", "keyboard", "headphones", "electronics", "iphone", "audio"]):
        categories.append("electronics")
    if any(w in text_lower for w in ["organic", "free-range", "almond milk", "dairy-alternative"]):
        categories.append("groceries-organic")
    if any(w in text_lower for w in ["vegetable", "fruit", "tomato", "onion", "spinach", "coriander", "greens", "sabzi", "sabji", "apples", "raspberries"]):
        categories.append("groceries-fresh")
        
    if not categories:
        categories.append("other")

    # 3. Discovery-Related Heuristics
    # Checks for direct signals of discovery failure, blind buying, or habit muscle memory
    is_discovery = False
    discovery_indicators = [
        "didn't know", "did not know", "stumbled", "discover", "explore", "exploring",
        "no shade swatches", "no swatches", "blind purchase", "no reviews", "no ingredient list",
        "muscle memory", "habit", "buy again", "reorder", "ordered before", "buy usual",
        "search UX", "brand filter", "sponsored results"
    ]
    if any(ind in text_lower for ind in discovery_indicators):
        is_discovery = True

    # 4. Trust-Related Heuristics
    is_trust = False
    trust_indicators = [
        "expired", "expiry", "tampered", "seal", "fake", "duplicate", "safety", "hygiene",
        "dust", "rotten", "mold", "sour", "smell", "unhygienic", "cleanliness", "warranty", "trust"
    ]
    if any(ind in text_lower for ind in trust_indicators):
        is_trust = True

    # 5. Sentiment Heuristics
    pos_words = ["great", "good", "amazing", "love", "fast", "convenient", "dependable", "nice", "best", "saved"]
    neg_words = ["bad", "terrible", "poor", "rot", "bruised", "expensive", "fail", "pain", "frustrating", "dented", "dirty", "unhygienic", "fake", "sour", "rotten", "dusty", "degrade", "ruin", "scared"]
    
    pos_count = sum(1 for w in pos_words if w in text_lower)
    neg_count = sum(1 for w in neg_words if w in text_lower)
    
    if rating is not None:
        if rating >= 4:
            sentiment = "positive"
        elif rating <= 2:
            sentiment = "negative"
        else:
            sentiment = "neutral"
    else:
        if pos_count > 0 and neg_count > 0:
            sentiment = "mixed"
        elif pos_count > 0:
            sentiment = "positive"
        elif neg_count > 0:
            sentiment = "negative"
        else:
            sentiment = "neutral"

    # 6. Translation
    translated = text
    if lang == "hinglish":
        translated = rule_based_translate(text)

    return {
        "topic": topic,
        "sentiment": sentiment,
        "categories_mentioned": categories,
        "is_discovery_related": is_discovery,
        "is_trust_related": is_trust,
        "language": lang,
        "translated_text": translated
    }

def main():
    clean_path = "data/clean/clean_data.json"
    cache_path = "data/clean/enrichment_cache.json"
    enriched_path = "data/clean/enriched_data.json"
    
    if not os.path.exists(clean_path):
        logger.error(f"Cleaned data file not found at {clean_path}. Run cleaning script first.")
        return
        
    with open(clean_path, "r", encoding="utf-8") as f:
        cleaned_data = json.load(f)
        
    # Load Cache
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
            logger.info(f"Loaded {len(cache)} cached items.")
        except Exception as e:
            logger.warning(f"Failed to load cache: {e}. Starting fresh.")
            
    # Check for Gemini API key and support comma-separated rotation
    api_key_env = os.getenv("GEMINI_API_KEY")
    api_keys = [k.strip() for k in api_key_env.split(",") if k.strip()] if api_key_env else []
    client = None
    current_key_idx = 0
    
    if api_keys:
        logger.info(f"GEMINI_API_KEY env detected. Found {len(api_keys)} keys for rotation. Initializing genai client...")
        try:
            from google import genai
            from google.genai import types
            from pydantic import BaseModel, Field
            
            # Pydantic schema for structured output
            class ReviewEnrichment(BaseModel):
                topic: str = Field(description="One of: delivery, fresh-produce, app-ux, discovery, pricing, trust, other")
                sentiment: str = Field(description="One of: positive, negative, neutral, mixed")
                categories_mentioned: List[str] = Field(description="List of categories mentioned: groceries-fresh, groceries-organic, pet-care, baby-care, personal-care, electronics, other")
                is_discovery_related: bool = Field(description="True if it mentions finding new products, category exploration barriers, or habit loops")
                is_trust_related: bool = Field(description="True if it mentions warehouse standards, freshness, safety, expiry, or counterfeit worries")
                language: str = Field(description="Language of the original text: en, hi, hinglish, other")
                translated_text: str = Field(description="Original review text translated to English if in Hindi/Hinglish, otherwise matching the original text")

            # Initialize first client
            client = genai.Client(api_key=api_keys[0])
            logger.info("First genai client successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize google-genai client: {e}. Fallback to rule-based tagger.")
            client = None
    else:
        logger.info("No GEMINI_API_KEY found. Running offline rule-based heuristic tagger.")
        
    def generate_content_with_rotation(prompt_text):
        nonlocal current_key_idx, client
        if not api_keys:
            raise ValueError("No API keys available.")
            
        max_attempts = len(api_keys) * 2
        attempts = 0
        
        while attempts < max_attempts:
            if client is None:
                current_key = api_keys[current_key_idx % len(api_keys)]
                logger.info(f"Rotating client to API key index {current_key_idx % len(api_keys)}")
                client = genai.Client(api_key=current_key)
                
            try:
                response = client.models.generate_content(
                    model='gemini-flash-latest',
                    contents=prompt_text,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ReviewEnrichment,
                        system_instruction=(
                            "You are an expert market analyst scoring quick commerce reviews. "
                            "Accurately assign topics, sentiment, categories, and translation parameters."
                        )
                    )
                )
                return response
            except Exception as e:
                err_msg = str(e).lower()
                if any(w in err_msg for w in ["429", "quota", "exhausted", "rate_limit", "too many requests"]):
                    current_key_idx += 1
                    client = None  # Reset client to force rotation on next loop iteration
                    logger.warning(f"Hit API rate limit or quota on key index {current_key_idx - 1}. Rotating key index to {current_key_idx % len(api_keys)}... (Attempt {attempts + 1}/{max_attempts})")
                    import time
                    time.sleep(2.0)
                    attempts += 1
                else:
                    raise e
        raise RuntimeError("All Gemini API keys are rate-limited or exhausted.")

    enriched_data = []
    api_calls_count = 0
    cache_hits_count = 0
    fallback_count = 0
    
    for i, item in enumerate(cleaned_data):
        text = item.get("text", "")
        rating = item.get("rating")
        lang = item.get("metadata", {}).get("language", "en")
        
        # Check cache (normalize key)
        norm_key = re.sub(r'\s+', ' ', text.strip().lower())
        
        if norm_key in cache:
            cache_hits_count += 1
            tags = cache[norm_key]
        elif client is not None:
            # Call Gemini Live with rotation support
            try:
                prompt = (
                    f"Analyze this quick-commerce customer review: '{text}'\n"
                    "Extract the tags matching the schema. If the review is in Hinglish or Hindi, "
                    "translate it to English in the 'translated_text' field."
                )
                
                response = generate_content_with_rotation(prompt)
                tags = json.loads(response.text)
                cache[norm_key] = tags
                api_calls_count += 1
                
                # Sleep briefly to respect free-tier RPM limits
                import time
                time.sleep(0.5)
            except Exception as llm_err:
                logger.warning(f"LLM extraction failed for review {i} after rotation: {llm_err}. Using rule-based fallback.")
                tags = rule_based_enrich(text, rating, lang)
                fallback_count += 1
        else:
            # Heuristic Fallback
            tags = rule_based_enrich(text, rating, lang)
            fallback_count += 1
            
        # Merge tags into item
        enriched_item = item.copy()
        enriched_item["topic"] = tags.get("topic", "other")
        enriched_item["sentiment"] = tags.get("sentiment", "neutral")
        enriched_item["categories_mentioned"] = tags.get("categories_mentioned", ["other"])
        enriched_item["is_discovery_related"] = tags.get("is_discovery_related", False)
        enriched_item["is_trust_related"] = tags.get("is_trust_related", False)
        enriched_item["translated_text"] = tags.get("translated_text", text)
        
        # Keep detailed language info in metadata
        enriched_item["metadata"]["language"] = tags.get("language", lang)
        enriched_item["language"] = tags.get("language", lang)
        
        enriched_data.append(enriched_item)
        
        if (i + 1) % 100 == 0:
            logger.info(f"Processed {i + 1}/{len(cleaned_data)} reviews...")
            
    # Write enriched output
    with open(enriched_path, "w", encoding="utf-8") as f:
        json.dump(enriched_data, f, indent=4, ensure_ascii=False)
        
    # Write Cache
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=4, ensure_ascii=False)
        
    logger.info("Enrichment processing completed.")
    logger.info(f" - Enriched records saved to: {enriched_path}")
    logger.info(f" - Cache hits: {cache_hits_count}")
    logger.info(f" - Live API calls: {api_calls_count}")
    logger.info(f" - Heuristic / Fallback runs: {fallback_count}")
    logger.info(f" - Cache written back to: {cache_path}")

if __name__ == "__main__":
    main()
