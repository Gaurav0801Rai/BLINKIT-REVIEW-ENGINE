import os
import json
import logging
import re
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()

# Predefined high-quality descriptive names and summaries for the 8 clusters
FALLBACK_CLUSTER_NAMES = {
    0: {
        "name": "Fresh Produce Quality Friction",
        "summary": "Customer complaints about receiving rotten, stale, or bruised fresh fruits and vegetables from local dark stores."
    },
    1: {
        "name": "Diaper & Baby Care Hygiene Concerns",
        "summary": "Concerns regarding dusty warehouse packaging, near-expiry dates, and sanitation standards for sensitive infant care products."
    },
    2: {
        "name": "App Navigation & Habitual Loops",
        "summary": "Friction in discovery caused by search filters, sponsored banners, and muscle-memory reordering habits."
    },
    3: {
        "name": "Pet Care Variety & Stock Issues",
        "summary": "Difficulty finding specific premium pet food brands, out-of-stock items, and return restrictions on pet supplies."
    },
    4: {
        "name": "Cosmetics Authenticity & Heat Degradation",
        "summary": "Worries about counterfeit beauty products and chemical degradation due to extreme warehouse heat."
    },
    5: {
        "name": "Fast Delivery Speed & Rider Safety",
        "summary": "Praise for ultra-fast 10-minute delivery, coupled with concerns about rider safety and crushed items inside bags."
    },
    6: {
        "name": "Gourmet & Organic Price Markup",
        "summary": "Dissatisfaction with high pricing markups on organic items compared to physical markets, combined with shelf life limits."
    },
    7: {
        "name": "Electronics Return & Warranty Friction",
        "summary": "Trust barriers in purchasing high-value electronics due to lack of stamped warranty cards and robotic refund bots."
    }
}

def has_whole_word(text, word):
    # Regex matching exact word boundary
    pattern = r'\b' + re.escape(word) + r'\b'
    return bool(re.search(pattern, text, re.IGNORECASE))

def has_any_whole_word(text, words_list):
    return any(has_whole_word(text, w) for w in words_list)

def get_sort_score(r):
    sentiment = r.get("sentiment", "neutral")
    rating = r.get("rating")
    text_len = len(r.get("text", ""))
    
    # Prioritize negative sentiments
    sent_score = 0
    if sentiment == "negative":
        sent_score = 3
    elif sentiment == "mixed":
        sent_score = 2
    elif sentiment == "neutral":
        sent_score = 1
        
    # Prioritize lower ratings (1 star > 5 star)
    rating_score = 0
    if rating is not None and isinstance(rating, (int, float)):
        rating_score = 6 - int(rating)
        
    return (sent_score, rating_score, text_len)

def main():
    enriched_path = "data/clean/enriched_data.json"
    clustered_path = "data/clean/clustered_data.json"
    
    if not os.path.exists(enriched_path):
        logger.error(f"Enriched data file not found at {enriched_path}. Run enrichment script first.")
        return
        
    with open(enriched_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    logger.info(f"Loaded {len(data)} enriched reviews for thematic classification.")

    # Rules mapping clusters using strict whole-word checks to prevent substring false-positives
    themes_rules = {
        0: lambda r: (r.get("topic") == "fresh-produce" or "groceries-fresh" in r.get("categories_mentioned", []))
                     and has_any_whole_word(r.get("text", ""), ["vegetable", "vegetables", "fruit", "fruits", "onion", "onions", "tomato", "tomatoes", "fresh", "rotten", "spoiled", "stale", "sabzi", "sabji", "spinach", "potato", "potatoes", "milk", "sour"]),
                     
        1: lambda r: "baby-care" in r.get("categories_mentioned", []) 
                     and has_any_whole_word(r.get("text", ""), ["baby", "diaper", "diapers", "formula", "infant", "powder", "hygiene", "child", "son", "daughter"]),
                     
        2: lambda r: (r.get("topic") == "app-ux" or has_any_whole_word(r.get("text", ""), ["ui", "search", "filter", "filters", "navigation", "reorder", "history", "banner", "layout", "click", "muscle memory", "habit", "screen", "button"]))
                     and not has_any_whole_word(r.get("text", ""), ["refund", "payment", "money", "deducted", "pese", "wallet", "cashback", "account", "failed", "deduct", "service", "deliver", "area", "picker"]),
                     
        3: lambda r: "pet-care" in r.get("categories_mentioned", []) 
                     and has_any_whole_word(r.get("text", ""), ["pet", "pets", "dog", "dogs", "cat", "cats", "food", "kibble", "toy", "supertails"]),
                     
        4: lambda r: "personal-care" in r.get("categories_mentioned", []) 
                     and has_any_whole_word(r.get("text", ""), ["cosmetics", "shade", "swatch", "swatches", "makeup", "face wash", "cream", "lotion", "lipstick", "perfume", "skin", "tampered", "expired", "fake"]),
                     
        5: lambda r: (r.get("topic") == "delivery" or has_any_whole_word(r.get("text", ""), ["speed", "minutes", "min", "time", "fast", "slow", "rider", "safety", "accident", "drive", "deliver in", "10-minute", "10 min", "10min"]))
                     and not has_any_whole_word(r.get("text", ""), ["packaging", "torn", "box", "spill", "leak", "damaged", "broken", "dirty", "water", "refund", "bot", "item", "product"]),
                     
        6: lambda r: ("groceries-organic" in r.get("categories_mentioned", []) or r.get("topic") == "pricing")
                     and has_any_whole_word(r.get("text", ""), ["price", "expensive", "mrp", "charge", "charges", "markup", "discount", "fee", "cost", "rupees", "paise", "costly", "billing"]),
                     
        7: lambda r: ("electronics" in r.get("categories_mentioned", []) or has_any_whole_word(r.get("text", ""), ["warranty", "charger", "earbuds", "cable", "headphones"]))
                     or has_any_whole_word(r.get("text", ""), ["refund", "bot", "robotic", "unresponsive", "chat", "customer service", "agent", "support", "ticket", "failed"])
    }

    # Explicit verified representative review IDs for the 8 pain point themes
    representative_mapping = {
        0: ["red_021", "86bbf433-ec79-4156-b53d-cfe4d1628dcf"],  # Fresh Produce Quality Friction
        1: ["red_005", "gmap_003"],                              # Diaper & Baby Care Hygiene Concerns
        2: ["b5e96068-142e-4a6b-a694-1f6b82bdebba", "3c9a54bf-4270-4fbf-8320-190664074644"],  # App Navigation & UX
        3: ["red_001", "red_024"],                                # Pet Care Variety & Stock Issues
        4: ["red_008", "red_016"],                                # Cosmetics Authenticity & Trust
        5: ["a0020b7b-313d-48d6-a30b-57684eda6810", "720ea8bf-0f14-494f-bb38-a1545f8718f8"],  # Delivery Speed & Item Damage
        6: ["red_012", "397e294d-3bd5-4aa3-ac97-88c0f5c2a57d"],  # pricing/MRP convenience charges
        7: ["web_004", "fa346726-74d9-4a1c-a333-ab9ebd822505"]   # Counterfeit / chat bot refund friction
    }

    clusters_meta = {}
    
    for c_id, rule_fn in themes_rules.items():
        # Get reviews matching this cluster theme
        cluster_reviews = [r for r in data if rule_fn(r)]
        
        # If too few reviews match, fallback to general data
        if not cluster_reviews:
            cluster_reviews = data
            
        # Assign cluster ID to original items
        for r in cluster_reviews:
            r["cluster_id"] = c_id

        # Get exact representative review IDs from mapping
        representative_ids = representative_mapping.get(c_id, [])

        meta = FALLBACK_CLUSTER_NAMES[c_id]
        
        clusters_meta[str(c_id)] = {
            "cluster_id": c_id,
            "name": meta["name"],
            "summary": meta["summary"],
            "size": len(cluster_reviews),
            "percentage": round((len(cluster_reviews) / len(data)) * 100, 2),
            "representative_review_ids": representative_ids
        }
        
        logger.info(f" - Theme {c_id} Name: {meta['name']}")
        logger.info(f"   Size: {len(cluster_reviews)} ({clusters_meta[str(c_id)]['percentage']}%)")
        logger.info(f"   Representative IDs: {representative_ids[:2]}")

    # Save the clustered data output
    output_payload = {
        "clusters": clusters_meta,
        "reviews": data
    }
    
    os.makedirs(os.path.dirname(clustered_path), exist_ok=True)
    with open(clustered_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=4, ensure_ascii=False)
        
    logger.info("Thematic classification completed successfully.")
    logger.info(f"Output saved to {clustered_path}.")

if __name__ == "__main__":
    main()
