import os
import json
import re
import logging
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Common Hinglish/transliterated Hindi stopwords and indicators
HINGLISH_KEYWORDS = {
    'nhi', 'nhi', 'nhi', 'nhi', 'nhi', 'nahi', 'hai', 'h', 'ko', 'se', 'ki', 'ke', 'ka', 'kr', 'kar', 
    'karna', 'karo', 'kya', 'bhai', 'bhaiya', 'ho', 'bohot', 'bahut', 'aur', 'pe', 'par', 
    'kuch', 'yaar', 'accha', 'achha', 'bhi', 'tha', 'thi', 'the', 'isame', 'isko', 'isse', 
    'hota', 'hoti', 'ye', 'yeh', 'wo', 'woh', 'gaya', 'gayi', 'gaye', 'aaj', 'kal', 'parso', 
    'jaldi', 'badhiya', 'kharab', 'bekar', 'acha', 'nhi', 'sabse', 'lekin', 'kyun', 'kyu', 
    'kaise', 'kab', 'kaha', 'kahan', 'meri', 'mera', 'mere', 'apna', 'apni', 'apne', 'toh', 
    'to', 'ek', 'do', 'raha', 'rahi', 'rahe', 'chal', 'rha', 'chahiye', 'chahiya', 'karta', 
    'karti', 'rhi', 'rhe', 'krte', 'krna', 'karta', 'hum', 'tum', 'aap', 'unka', 'apne', 
    'khareedna', 'khareeda', 'mangaya', 'mangaya', 'aata', 'aati', 'paise', 'rupaye', 'laga'
}

def is_emoji_only(text):
    # Regex to strip emojis and standard whitespaces/punctuation
    # If nothing is left or no alphanumeric character exists, it is emoji-only or non-substantive
    cleaned = re.sub(r'[^\w\s]', '', text)
    cleaned = cleaned.strip()
    return len(cleaned) == 0

def detect_language(text):
    # Tokenize the text into alphanumeric words
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    if not words:
        return "en" # Fallback
        
    # Count matching Hinglish keywords
    matched = [word for word in words if word in HINGLISH_KEYWORDS]
    unique_matched = set(matched)
    
    # Calculate ratio of Hinglish tokens
    ratio = len(matched) / len(words)
    
    # If we have at least 2 unique Hinglish words and the ratio is >= 8% (or if we have 3+ unique words)
    if (len(unique_matched) >= 2 and ratio >= 0.08) or len(unique_matched) >= 3:
        return "hinglish"
        
    return "en"

def main():
    raw_path = "data/raw/raw_data.json"
    clean_dir = "data/clean"
    clean_path = os.path.join(clean_dir, "clean_data.json")
    
    if not os.path.exists(raw_path):
        logger.error(f"Raw data file not found at {raw_path}. Run collection script first.")
        return
        
    with open(raw_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    raw_count = len(raw_data)
    logger.info(f"Loaded {raw_count} raw items.")
    
    # 1. Deduplication
    seen_texts = set()
    seen_ids = set()
    deduped_data = []
    
    dup_id_count = 0
    dup_text_count = 0
    
    for item in raw_data:
        # Check duplicate ID
        item_id = item.get("id")
        if item_id in seen_ids:
            dup_id_count += 1
            continue
            
        # Clean text for duplication check (lowercase, strip whitespaces)
        text = item.get("text", "")
        if not text:
            continue
            
        norm_text = re.sub(r'\s+', ' ', text.strip().lower())
        if norm_text in seen_texts:
            dup_text_count += 1
            continue
            
        seen_ids.add(item_id)
        seen_texts.add(norm_text)
        deduped_data.append(item)
        
    deduped_count = len(deduped_data)
    logger.info(f"Deduplication results: Removed {dup_id_count} matching IDs, {dup_text_count} duplicate text bodies.")
    logger.info(f"Remaining records after deduplication: {deduped_count}")
    
    # 2. Filtering noise (length >= 25, non-emoji only, non-empty)
    cleaned_data = []
    excluded_short = 0
    excluded_emoji = 0
    
    for item in deduped_data:
        text = item.get("text", "").strip()
        
        # Check emoji-only/non-alphanumeric noise
        if is_emoji_only(text):
            excluded_emoji += 1
            continue
            
        # Check length threshold
        if len(text) < 25:
            excluded_short += 1
            continue
            
        # Detect language (flag Hinglish vs English)
        lang = detect_language(text)
        
        # Update metadata and record
        if "metadata" not in item:
            item["metadata"] = {}
            
        item["metadata"]["language"] = lang
        item["language"] = lang
        
        # Clean up text white spaces
        item["text"] = re.sub(r'[ \t\r\f]+', ' ', text)
        
        cleaned_data.append(item)
        
    final_count = len(cleaned_data)
    logger.info(f"Funnel Filters results:")
    logger.info(f" - Excluded emoji-only / empty: {excluded_emoji}")
    logger.info(f" - Excluded short reviews (<25 chars): {excluded_short}")
    logger.info(f" - Final cleaned records: {final_count}")
    
    # Generate stats of final dataset languages
    lang_counts = Counter([item["language"] for item in cleaned_data])
    logger.info("Language distribution:")
    for lang, cnt in lang_counts.items():
        logger.info(f" - {lang}: {cnt} reviews")
        
    # Ensure directory exists and write final JSON
    os.makedirs(clean_dir, exist_ok=True)
    with open(clean_path, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, indent=4, ensure_ascii=False)
        
    # Write a clean stats log file for review
    funnel_log = {
        "funnel_funnel": {
            "1_raw_collected": raw_count,
            "2_deduplicated": deduped_count,
            "3_cleaned_final": final_count
        },
        "exclusions": {
            "duplicate_ids": dup_id_count,
            "duplicate_texts": dup_text_count,
            "emoji_only": excluded_emoji,
            "short_text_under_25_chars": excluded_short
        },
        "language_distribution": dict(lang_counts)
    }
    
    funnel_log_path = os.path.join(clean_dir, "cleaning_metrics.json")
    with open(funnel_log_path, "w", encoding="utf-8") as f:
        json.dump(funnel_log, f, indent=4, ensure_ascii=False)
        
    logger.info(f"Exclusion metrics logged successfully at {funnel_log_path}")

if __name__ == "__main__":
    main()
