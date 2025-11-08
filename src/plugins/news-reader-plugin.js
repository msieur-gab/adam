/**
 * News Reader Plugin
 * Fetches RSS feeds and reads articles aloud
 */

import { BasePlugin } from './plugin-base.js';

export class NewsReaderPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'news-reader',
      name: 'News Reader',
      version: '1.0.0',
      description: 'Reads news from RSS feeds',
      author: 'ADAM Team'
    });

    // Default RSS feeds
    this.feeds = {
      bbc_world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      bbc_tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
      bbc_health: 'https://feeds.bbci.co.uk/news/health/rss.xml'
    };

    // Cache for latest articles
    this.cachedArticles = [];
    this.cacheTimestamp = null;
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes

    // Current reading state
    this.currentFeed = 'bbc_world';
  }

  /**
   * Register NLU patterns for news intents
   */
  getNLUPatterns() {
    return {
      // Subject patterns
      subjects: {
        news: {
          nouns: ['news', 'headlines', 'article', 'story', 'report'],
          adjectives: ['latest', 'recent', 'top'],
          verbs: ['read'],
          priority: 9
        }
      },

      // Action patterns (extends base action keywords)
      actions: {
        read: ['read', 'open', 'show']
      },

      // Intent mappings (how action + subject = intent)
      intents: {
        'query_news': 'news_headlines',
        'check_news': 'news_headlines',
        'tell_news': 'news_headlines',
        'show_news': 'news_headlines',
        'read_news': 'news_read',
        'open_news': 'news_read',
        'read_article': 'news_read',
        'open_article': 'news_read'
      }
    };
  }

  /**
   * Register intents
   */
  getIntents() {
    return [
      'news_headlines',  // "what's the news", "show me headlines"
      'news_read',       // "read the news", "read article 3"
      'news_select'      // "read number 2", "tell me about article 1"
    ];
  }

  /**
   * Parse RSS feed
   */
  async fetchFeed(feedUrl) {
    try {
      // Use proxy endpoint to avoid CORS issues
      const proxyUrl = `/api/rss?url=${encodeURIComponent(feedUrl)}`;
      const response = await fetch(proxyUrl);
      const xmlText = await response.text();

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Extract items
      const items = xmlDoc.querySelectorAll('item');
      const articles = [];

      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const item = items[i];

        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';

        articles.push({
          number: i + 1,
          title: this.cleanHtml(title),
          description: this.cleanHtml(description),
          link: link,
          pubDate: new Date(pubDate),
          summary: this.createSummary(description)
        });
      }

      return articles;

    } catch (error) {
      console.error('[NewsReader] Failed to fetch feed:', error);
      return [];
    }
  }

  /**
   * Clean HTML from text
   */
  cleanHtml(text) {
    if (!text) return '';
    // Remove HTML tags
    const cleaned = text.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = cleaned;
    return textarea.value;
  }

  /**
   * Create short summary from description
   */
  createSummary(description) {
    const cleaned = this.cleanHtml(description);
    // Take first 100 characters
    if (cleaned.length <= 100) return cleaned;
    return cleaned.substring(0, 100) + '...';
  }

  /**
   * Fetch full article content from BBC article page
   */
  async fetchArticleContent(url) {
    try {
      // Use proxy to avoid CORS
      const proxyUrl = `/api/rss?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const htmlText = await response.text();

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // BBC articles have content in specific elements
      // Try multiple selectors for different BBC article formats
      let content = '';

      // Try main article body
      const articleBody = doc.querySelector('[data-component="text-block"]') ||
                         doc.querySelector('article') ||
                         doc.querySelector('.article__body') ||
                         doc.querySelector('.story-body');

      if (articleBody) {
        // Get all paragraphs
        const paragraphs = articleBody.querySelectorAll('p');
        content = Array.from(paragraphs)
          .map(p => p.textContent.trim())
          .filter(text => text.length > 20) // Filter out short snippets
          .join(' ');
      }

      // If we got content, return it; otherwise fall back to description
      return content.length > 100 ? content : null;

    } catch (error) {
      console.error('[NewsReader] Failed to fetch article content:', error);
      return null;
    }
  }

  /**
   * Get cached articles or fetch new ones
   */
  async getArticles(feedKey = 'bbc_world') {
    const now = Date.now();

    // Return cached if still valid
    if (this.cachedArticles.length > 0 &&
        this.cacheTimestamp &&
        (now - this.cacheTimestamp) < this.cacheDuration) {
      console.log('[NewsReader] Using cached articles');
      return this.cachedArticles;
    }

    // Fetch fresh articles
    console.log('[NewsReader] Fetching fresh articles from:', feedKey);
    const feedUrl = this.feeds[feedKey] || this.feeds.bbc_world;
    const articles = await this.fetchFeed(feedUrl);

    // Update cache
    this.cachedArticles = articles;
    this.cacheTimestamp = now;
    this.currentFeed = feedKey;

    return articles;
  }

  /**
   * Handle plugin queries
   */
  async handleQuery(intent, params) {
    switch (intent) {
      case 'news_headlines':
        return await this.handleHeadlines(params);

      case 'news_read':
      case 'news_select':
        return await this.handleReadArticle(params);

      default:
        return {
          success: false,
          error: `Unknown intent: ${intent}`
        };
    }
  }

  /**
   * Handle headlines request
   */
  async handleHeadlines(params) {
    const articles = await this.getArticles();

    if (articles.length === 0) {
      return {
        success: false,
        error: 'Could not fetch news headlines'
      };
    }

    return {
      success: true,
      type: 'headlines',
      articles: articles,
      count: articles.length,
      feed: this.currentFeed
    };
  }

  /**
   * Convert word numbers to integers
   */
  wordToNumber(word) {
    const wordMap = {
      'one': 1, 'first': 1, '1st': 1,
      'two': 2, 'second': 2, '2nd': 2,
      'three': 3, 'third': 3, '3rd': 3,
      'four': 4, 'fourth': 4, '4th': 4,
      'five': 5, 'fifth': 5, '5th': 5
    };
    return wordMap[word.toLowerCase()] || null;
  }

  /**
   * Handle read article request
   */
  async handleReadArticle(params) {
    // Try to extract number from various places
    let number = null;

    console.log('[NewsReader] handleReadArticle params:', params);

    // Check direct params
    if (params.articleNumber) {
      number = parseInt(params.articleNumber);
    }

    // Check entities
    if (!number && params.entities) {
      // Check number entity
      if (params.entities.number) {
        const numValue = params.entities.number.value;
        number = typeof numValue === 'number' ? numValue : this.wordToNumber(numValue) || parseInt(numValue);
      }
      // Check temporal (sometimes numbers end up there)
      if (!number && params.entities.temporal) {
        const match = String(params.entities.temporal.value).match(/\d+/);
        if (match) number = parseInt(match[0]);
      }
    }

    // Check slots
    if (!number && params.slots) {
      if (params.slots.number) {
        const numValue = params.slots.number;
        number = typeof numValue === 'number' ? numValue : this.wordToNumber(numValue) || parseInt(numValue);
      }
    }

    // If still no number, try raw text extraction from any param (both digits and words)
    if (!number) {
      const allValues = JSON.stringify(params);
      console.log('[NewsReader] Searching in all params:', allValues);

      // Try numeric digits first
      const digitMatch = allValues.match(/\b([1-5])\b/);
      if (digitMatch) {
        number = parseInt(digitMatch[1]);
      } else {
        // Try word forms
        const wordMatch = allValues.match(/\b(one|two|three|four|five|first|second|third|fourth|fifth)\b/i);
        if (wordMatch) {
          number = this.wordToNumber(wordMatch[1]);
        }
      }
    }

    console.log('[NewsReader] Extracted article number:', number);

    if (!number || number < 1 || number > 5) {
      console.log('[NewsReader] No valid number found, returning headlines');
      // Return headlines to let user choose
      return await this.handleHeadlines(params);
    }

    // Get the specific article
    const articles = await this.getArticles();
    const article = articles.find(a => a.number === number);

    if (!article) {
      return {
        success: false,
        error: `Article ${number} not found`
      };
    }

    // Fetch full article content from the BBC page
    console.log('[NewsReader] Fetching full article from:', article.link);
    const fullContent = await this.fetchArticleContent(article.link);

    // Use full content if available, otherwise fall back to RSS description
    const content = fullContent || article.description;

    console.log('[NewsReader] Article content length:', content.length, 'chars');

    return {
      success: true,
      type: 'article',
      article: article,
      content: content,
      number: number,
      isFull: !!fullContent // Indicate if we got the full article or just description
    };
  }

  /**
   * Add a custom RSS feed
   */
  addFeed(key, url) {
    this.feeds[key] = url;
    console.log(`[NewsReader] Added feed: ${key} -> ${url}`);
  }

  /**
   * Remove a feed
   */
  removeFeed(key) {
    delete this.feeds[key];
    console.log(`[NewsReader] Removed feed: ${key}`);
  }

  /**
   * List available feeds
   */
  listFeeds() {
    return Object.keys(this.feeds);
  }
}

// Export singleton instance
export const newsReaderPlugin = new NewsReaderPlugin();
export default NewsReaderPlugin;
