import requests
import json
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def fetch_reddit_search(query="blinkit", limit=100):
    # Reddit search JSON endpoint
    url = f"https://www.reddit.com/search.json?q={query}&limit={limit}&sort=relevance"
    
    # Custom browser-like User-Agent to avoid immediate blocks
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    logger.info(f"Querying Reddit search JSON API for '{query}'...")
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            posts = data.get("data", {}).get("children", [])
            logger.info(f"Retrieved {len(posts)} posts from Reddit.")
            return posts
        else:
            logger.error(f"Failed to query Reddit. Status code: {response.status_code}")
            logger.error(f"Response snippet: {response.text[:200]}")
            return []
    except Exception as e:
        logger.error(f"Error fetching Reddit data: {e}")
        return []

def extract_comments_from_post(permalink, max_comments=10):
    # Fetch thread comments by appending .json to the permalink
    url = f"https://www.reddit.com{permalink}.json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        # Rate-limiting cushion
        time.sleep(1.5)
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            # Reddit thread JSON returns a list: [post_data, comment_data]
            comments_root = data[1].get("data", {}).get("children", [])
            
            extracted = []
            for comment in comments_root[:max_comments]:
                c_data = comment.get("data", {})
                body = c_data.get("body")
                if body and not body.strip().startswith("[deleted]"):
                    extracted.append({
                        "id": f"red_comm_{c_data.get('id')}",
                        "text": body,
                        "author": c_data.get("author"),
                        "date": datetime_from_utc(c_data.get("created_utc")),
                        "upvotes": c_data.get("score")
                    })
            return extracted
    except Exception as e:
        logger.warning(f"Failed to fetch comments for {permalink}: {e}")
    return []

def datetime_from_utc(utc_ts):
    if not utc_ts:
        return None
    from datetime import datetime
    return datetime.utcfromtimestamp(utc_ts).isoformat() + "Z"

def main():
    # Fetch relevant posts about category discovery and quick commerce
    queries = ["blinkit grocery", "blinkit category", "blinkit fruits", "blinkit cosmetics"]
    all_reddit_records = []
    seen_ids = set()
    
    for q in queries:
        posts = fetch_reddit_search(q, limit=15)
        for post in posts:
            p_data = post.get("data", {})
            post_id = p_data.get("id")
            if post_id not in seen_ids:
                seen_ids.add(post_id)
                
                # Append the post itself
                title = p_data.get("title")
                selftext = p_data.get("selftext", "")
                full_text = f"{title}\n{selftext}" if selftext else title
                
                all_reddit_records.append({
                    "id": f"red_post_{post_id}",
                    "source": "reddit",
                    "text": full_text,
                    "rating": None,
                    "date": datetime_from_utc(p_data.get("created_utc")),
                    "author": p_data.get("author"),
                    "permalink_or_url": f"https://reddit.com{p_data.get('permalink')}",
                    "metadata": {
                        "subreddit": p_data.get("subreddit"),
                        "upvotes": p_data.get("score"),
                        "type": "submission"
                    }
                })
                
                # Fetch comments to build qualitative data
                permalink = p_data.get("permalink")
                comments = extract_comments_from_post(permalink, max_comments=5)
                for comment in comments:
                    all_reddit_records.append({
                        "id": comment["id"],
                        "source": "reddit",
                        "text": comment["text"],
                        "rating": None,
                        "date": comment["date"],
                        "author": comment["author"],
                        "permalink_or_url": f"https://reddit.com{permalink}",
                        "metadata": {
                            "subreddit": p_data.get("subreddit"),
                            "upvotes": comment["upvotes"],
                            "type": "comment",
                            "parent_post_id": f"red_post_{post_id}"
                        }
                    })
                    
        # Pause to avoid getting blocked
        time.sleep(2)
        
    # Output file
    output_file = "data/raw/reddit_extra_data.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_reddit_records, f, indent=4, ensure_ascii=False)
        
    logger.info(f"Reddit scrape completed. Saved {len(all_reddit_records)} records to {output_file}.")

if __name__ == "__main__":
    main()
