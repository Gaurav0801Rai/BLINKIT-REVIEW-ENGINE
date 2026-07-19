import os
import json
import logging
from datetime import datetime
from google_play_scraper import reviews, Sort
from app_store_scraper import AppStore
from seed_data import get_all_seed_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def clean_date(val):
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

def collect_play_store(limit=1500):
    logger.info("Starting Play Store reviews extraction for 'com.grofers.customerapp'...")
    try:
        raw_reviews, _ = reviews(
            'com.grofers.customerapp',
            lang='en',
            country='in',
            sort=Sort.NEWEST,
            count=limit
        )
        logger.info(f"Successfully fetched {len(raw_reviews)} reviews from Play Store.")
        
        extracted = []
        for r in raw_reviews:
            extracted.append({
                "id": r.get("reviewId"),
                "source": "play_store",
                "text": r.get("content"),
                "rating": r.get("score"),
                "date": clean_date(r.get("at")),
                "author": r.get("userName"),
                "permalink_or_url": f"https://play.google.com/store/apps/details?id=com.grofers.customerapp&reviewId={r.get('reviewId')}",
                "metadata": {
                    "thumbs_up_count": r.get("thumbsUpCount"),
                    "app_version": r.get("reviewCreatedVersion"),
                    "reply_content": r.get("replyContent"),
                    "replied_at": clean_date(r.get("repliedAt")) if r.get("repliedAt") else None
                }
            })
        return extracted
    except Exception as e:
        logger.error(f"Failed to fetch Play Store reviews: {e}")
        return []

def collect_app_store(limit=800):
    logger.info("Starting App Store reviews extraction for app_id '1000676737'...")
    # Attempting to fetch App Store reviews using app-store-scraper
    try:
        # app-store-scraper can sometimes fail due to Apple RSS issues, handle gracefully.
        blinkit_ios = AppStore(country='in', app_name='blinkit-groceries-more', app_id=1000676737)
        blinkit_ios.review(how_many=limit)
        
        raw_reviews = blinkit_ios.reviews
        if not raw_reviews:
            logger.warning("App Store live RSS returned 0 reviews. Fallback to App Store seed reviews.")
            return []
            
        logger.info(f"Successfully fetched {len(raw_reviews)} reviews from App Store.")
        extracted = []
        for i, r in enumerate(raw_reviews):
            # Unique ID prefix
            review_id = f"ios_{i}_{datetime.now().strftime('%f')}"
            extracted.append({
                "id": review_id,
                "source": "app_store",
                "text": r.get("review"),
                "rating": r.get("rating"),
                "date": clean_date(r.get("date")),
                "author": r.get("userName"),
                "permalink_or_url": f"https://apps.apple.com/in/app/blinkit-groceries-more/id1000676737#review_{i}",
                "metadata": {
                    "app_version": r.get("isEdited"),  # App store scraper edited status or version field if available
                    "title": r.get("title"),
                    "is_edited": r.get("isEdited")
                }
            })
        return extracted
    except Exception as e:
        logger.error(f"Failed to fetch App Store reviews live: {e}. Falling back to seed App Store reviews.")
        return []

def collect_reddit_live():
    # Attempt to fetch using PRAW if credentials exist in env
    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", "BlinkitGrowthInsights/1.0")
    
    if not client_id or not client_secret:
        logger.info("Reddit PRAW API credentials not set. Skipping live Reddit scrape. Fallback to Reddit seed discussions.")
        return []
        
    try:
        import praw
        logger.info("PRAW credentials found. Starting live Reddit extraction...")
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent
        )
        
        extracted = []
        # Search query for blinkit discovery & category issues in subreddits
        # Subreddits: r/india, r/bangalore, r/delhi, r/mumbai
        query = "blinkit OR grofers"
        subreddits = ["india", "bangalore", "delhi", "mumbai", "indiafood"]
        
        for sub_name in subreddits:
            try:
                subreddit = reddit.subreddit(sub_name)
                # Search matching submissions
                for submission in subreddit.search(query, limit=10, sort="relevance"):
                    post_id = f"red_post_{submission.id}"
                    extracted.append({
                        "id": post_id,
                        "source": "reddit",
                        "text": f"{submission.title}\n{submission.selftext}",
                        "rating": None,
                        "date": datetime.utcfromtimestamp(submission.created_utc).isoformat() + "Z",
                        "author": str(submission.author),
                        "permalink_or_url": f"https://reddit.com{submission.permalink}",
                        "metadata": {
                            "subreddit": sub_name,
                            "upvotes": submission.score,
                            "type": "submission",
                            "num_comments": submission.num_comments
                        }
                    })
                    
                    # Fetch top comments
                    submission.comments.replace_more(limit=0) # flatten comments tree
                    for comment in submission.comments.list()[:10]: # limit to top 10 comments per post
                        extracted.append({
                            "id": f"red_comm_{comment.id}",
                            "source": "reddit",
                            "text": comment.body,
                            "rating": None,
                            "date": datetime.utcfromtimestamp(comment.created_utc).isoformat() + "Z",
                            "author": str(comment.author),
                            "permalink_or_url": f"https://reddit.com{comment.permalink}",
                            "metadata": {
                                "subreddit": sub_name,
                                "upvotes": comment.score,
                                "type": "comment",
                                "parent_post_id": post_id
                            }
                        })
            except Exception as sub_err:
                logger.warning(f"Failed to scrape subreddit r/{sub_name}: {sub_err}")
                
        logger.info(f"Live Reddit scraped {len(extracted)} items.")
        return extracted
    except Exception as e:
        logger.error(f"Failed to run live Reddit scraper: {e}")
        return []

def collect_web_search_data_only():
    logger.info("Parsing blinkit_web_search_data_only.json to extract web research verbatims...")
    research_path = "blinkit_web_search_data_only.json"
    if not os.path.exists(research_path):
        logger.warning("blinkit_web_search_data_only.json not found in root directory!")
        return []
    try:
        with open(research_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        extracted = []
        
        # 1. Parse Trustpilot sample reviews
        tp_reviews = data.get("user_reviews_trustpilot", {}).get("sample_reviews", [])
        for idx, r in enumerate(tp_reviews):
            extracted.append({
                "id": f"web_tp_{idx}",
                "source": "web_search_data",
                "text": r.get("text"),
                "rating": r.get("rating"),
                "date": clean_date(r.get("date")) if r.get("date") else "2026-07-17T00:00:00Z",
                "author": f"trustpilot_user_{idx}",
                "permalink_or_url": data.get("user_reviews_trustpilot", {}).get("source_url", "https://www.trustpilot.com/review/blinkit.nl"),
                "metadata": {
                    "original_source": "Trustpilot - Blinkit reviews",
                    "theme": r.get("theme")
                }
            })
            
        # 2. Parse Reddit sample discussions
        red_discussions = data.get("user_reviews_reddit", {}).get("sample_discussions", [])
        for idx, r in enumerate(red_discussions):
            extracted.append({
                "id": f"web_red_{idx}",
                "source": "web_search_data",
                "text": r.get("quote"),
                "rating": None,
                "date": "2026-07-17T00:00:00Z",
                "author": f"reddit_user_{idx}",
                "permalink_or_url": data.get("user_reviews_reddit", {}).get("source_urls", ["https://reddit.com"])[0],
                "metadata": {
                    "original_source": f"Reddit - {r.get('subreddit')}",
                    "theme": r.get("theme")
                }
            })
            
        # 3. Parse DigiLawyer complaints
        lawyer_complaints = data.get("consumer_complaints_digilawyer", {}).get("top_complaints", [])
        for idx, r in enumerate(lawyer_complaints):
            extracted.append({
                "id": f"web_law_{idx}",
                "source": "web_search_data",
                "text": f"{r.get('complaint')}: {r.get('description')}",
                "rating": None,
                "date": data.get("consumer_complaints_digilawyer", {}).get("date", "2026-03-02") + "T00:00:00Z",
                "author": f"digilawyer_complaint_{idx}",
                "permalink_or_url": data.get("consumer_complaints_digilawyer", {}).get("source_url", "https://digilawyer.ai"),
                "metadata": {
                    "original_source": "DigiLawyer Consumer Complaints",
                    "complaint": r.get("complaint")
                }
            })
            
        # 4. Parse business model economic details & risks as text items
        business = data.get("blinkit_business_model", {})
        idx = 0
        for key, val in business.get("revenue_streams", {}).items():
            extracted.append({
                "id": f"web_biz_rev_{idx}",
                "source": "web_search_data",
                "text": f"Blinkit Revenue Stream - {key.replace('_', ' ').title()}: {val}",
                "rating": None,
                "date": "2026-07-17T00:00:00Z",
                "author": "analyst",
                "permalink_or_url": "https://blinkit.com",
                "metadata": {"original_source": "Blinkit Business Model"}
            })
            idx += 1
            
        # 5. Parse critical risks
        risks = data.get("regulatory_and_risks", {}).get("critical_risks", [])
        for idx, r in enumerate(risks):
            extracted.append({
                "id": f"web_risk_{idx}",
                "source": "web_search_data",
                "text": f"Critical Operation/Regulatory Risk: {r}",
                "rating": None,
                "date": "2026-07-17T00:00:00Z",
                "author": "analyst",
                "permalink_or_url": "https://blinkit.com",
                "metadata": {"original_source": "Regulatory and Risks"}
            })

        logger.info(f"Extracted {len(extracted)} reviews/quotes/observations from blinkit_web_search_data_only.json.")
        return extracted
    except Exception as e:
        logger.error(f"Failed to parse blinkit_web_search_data_only.json: {e}")
        return []

def main():
    # Make sure output directory exists
    os.makedirs("data/raw", exist_ok=True)
    
    # 1. Fetch live Play Store reviews
    play_store_reviews = collect_play_store(limit=4000)
    
    # 2. Fetch live App Store reviews
    app_store_reviews = collect_app_store(limit=800)
    
    # 3. Fetch live Reddit discussions
    reddit_reviews = collect_reddit_live()
    
    # 4. Load all seed fallback data (Reddit, App Store, forums, social, products, discussions)
    seed_data = get_all_seed_data()
    
    # 5. Extract quotes from blinkit_web_search_data_only.json
    research_reviews = collect_web_search_data_only()
    
    # Consolidate and merge datasets
    final_dataset = []
    
    # Track IDs to prevent duplicate reviews
    seen_ids = set()
    
    # Add live play store
    for r in play_store_reviews:
        if r["id"] not in seen_ids:
            final_dataset.append(r)
            seen_ids.add(r["id"])
            
    # Add live app store if found, otherwise let seed App Store reviews take over
    if app_store_reviews:
        for r in app_store_reviews:
            if r["id"] not in seen_ids:
                final_dataset.append(r)
                seen_ids.add(r["id"])
                
    # Add live Reddit if found, otherwise let seed Reddit reviews take over
    if reddit_reviews:
        for r in reddit_reviews:
            if r["id"] not in seen_ids:
                final_dataset.append(r)
                seen_ids.add(r["id"])
                
    # Merge seed data (fallbacks for non-live sources or when live returned 0)
    for r in seed_data:
        # If we scraped live Reddit, we do not want to overlap with seed Reddit (optional but keeps data clean)
        if r["source"] == "reddit" and reddit_reviews:
            continue
        if r["source"] == "app_store" and app_store_reviews:
            continue
            
        if r["id"] not in seen_ids:
            final_dataset.append(r)
            seen_ids.add(r["id"])
            
    # Merge research reviews
    for r in research_reviews:
        if r["id"] not in seen_ids:
            final_dataset.append(r)
            seen_ids.add(r["id"])
            
    # Save the consolidated raw data to file
    output_path = "data/raw/raw_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, indent=4, ensure_ascii=False)
        
    logger.info(f"Data collection pipeline completed successfully.")
    logger.info(f"Total reviews and discussions collected: {len(final_dataset)}")
    
    # Print stats by source
    from collections import Counter
    counts = Counter([item["source"] for item in final_dataset])
    for src, count in counts.items():
        logger.info(f" - {src}: {count} records")

if __name__ == "__main__":
    main()

