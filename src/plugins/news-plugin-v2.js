/**
 * News Plugin v2
 * Migrated to Dialogflow-style architecture
 *
 * Features:
 * - Headlines intent with feed selection
 * - Article reading with number extraction
 * - Follow-up context for "read article 2" after seeing headlines
 */

import { BasePlugin } from './plugin-base.js';

export class NewsPluginV2 extends BasePlugin {
  constructor() {
    super({
      id: 'news-v2',
      name: 'News v2',
      version: '2.0.0',
      description: 'Reads news from RSS feeds with intelligent conversation',
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
  }

  async initialize() {
    console.log('[NewsPluginV2] Initialized');
  }

  async cleanup() {
    console.log('[NewsPluginV2] Cleaned up');
  }

  /**
   * Define intent flows
   */
  getIntentFlows() {
    return {
      news_headlines: {
        // Scoring rules
        scoringRules: {
          // Required: news-related words
          required: [
            { nouns: ['news', 'headlines', 'article', 'story', 'report'] }
          ],

          // Boosters
          boosters: [
            { isQuestion: true, boost: 0.2 },
            { adjectives: ['latest', 'recent', 'top'], boost: 0.1 },
            { verbs: ['tell', 'show', 'give', 'read'], boost: 0.1 }
          ],

          // Anti-patterns
          antiPatterns: [
            { nouns: ['weather', 'time', 'reminder'], penalty: -0.5 },
            { hasNumber: true, penalty: -0.2 }  // "read article 2" should be read_article
          ]
        },

        // Parameters
        parameters: {
          feed: {
            entity: 'any',
            required: false,
            default: 'bbc_world',
            extractor: (signals) => this.extractFeed(signals)
          }
        },

        // Fulfillment
        fulfill: async (params) => {
          try {
            const articles = await this.getArticles(params.feed);

            if (articles.length === 0) {
              return {
                text: 'Sorry, I couldn\'t fetch the news headlines right now. Please try again later.',
                error: 'No articles found'
              };
            }

            // Format headlines for speech
            const headlinesList = articles
              .map(a => `Number ${a.number}: ${a.title}`)
              .join('. ');

            return {
              text: `Here are the top ${articles.length} headlines: ${headlinesList}. Which one would you like me to read?`,
              data: {
                articles,
                feed: params.feed,
                count: articles.length
              }
            };

          } catch (error) {
            console.error('[NewsPluginV2] Error fetching headlines:', error);
            return {
              text: 'Sorry, I had trouble fetching the news. Please try again.',
              error: error.message
            };
          }
        },

        // Output contexts
        outputContexts: [
          {
            name: 'news-headlines-shown',
            lifespan: 3,
            parameters: (result, params) => ({
              articles: result.data?.articles,
              feed: params.feed
            })
          }
        ]
      },

      read_article: {
        // Scoring rules
        scoringRules: {
          // Required: read/article + number
          required: [
            { verbs: ['read', 'open', 'show', 'tell'] },
            { nouns: ['article', 'story', 'number', 'one', 'two', 'three', 'four', 'five'] }
          ],

          // Boosters
          boosters: [
            { hasNumber: true, boost: 0.3 },
            { hasContext: 'news-headlines-shown', boost: 0.4 },
            { isCommand: true, boost: 0.1 }
          ],

          // Anti-patterns
          antiPatterns: [
            { nouns: ['weather', 'time', 'reminder'], penalty: -0.5 }
          ]
        },

        // Parameters
        parameters: {
          articleNumber: {
            entity: 'number',
            required: true,
            prompt: 'Which article number would you like me to read?',
            extractor: (signals) => this.extractArticleNumber(signals),
            validator: (number) => {
              if (!number || number < 1 || number > 5) {
                return { valid: false, error: 'Please choose a number between 1 and 5' };
              }
              return { valid: true };
            }
          }
        },

        // Fulfillment
        fulfill: async (params) => {
          try {
            const articles = await this.getArticles();
            const article = articles.find(a => a.number === params.articleNumber);

            if (!article) {
              return {
                text: `I couldn't find article number ${params.articleNumber}. Please try a number between 1 and 5.`,
                error: 'Article not found'
              };
            }

            // Fetch full content
            console.log('[NewsPluginV2] Fetching full article from:', article.link);
            const fullContent = await this.fetchArticleContent(article.link);
            const content = fullContent || article.description;

            return {
              text: `${article.title}. ${content}`,
              data: {
                article,
                content,
                number: params.articleNumber,
                isFull: !!fullContent
              }
            };

          } catch (error) {
            console.error('[NewsPluginV2] Error reading article:', error);
            return {
              text: 'Sorry, I had trouble reading that article. Please try another one.',
              error: error.message
            };
          }
        },

        // Output contexts
        outputContexts: [
          {
            name: 'article-read',
            lifespan: 2,
            parameters: (result, params) => ({
              lastArticle: result.data?.article,
              lastNumber: params.articleNumber
            })
          }
        ]
      }
    };
  }

  /**
   * Extract feed preference from signals
   * @private
   */
  extractFeed(signals) {
    const text = signals.normalizedText;

    if (text.includes('tech') || text.includes('technology')) {
      return 'bbc_tech';
    }
    if (text.includes('health') || text.includes('medical')) {
      return 'bbc_health';
    }

    return 'bbc_world';  // default
  }

  /**
   * Extract article number from signals
   * @private
   */
  extractArticleNumber(signals) {
    // Check for numeric numbers
    if (signals.numbers && signals.numbers.length > 0) {
      const number = signals.numbers[0].value;
      if (number >= 1 && number <= 5) {
        return number;
      }
    }

    // Check for word numbers in text
    const text = signals.normalizedText;
    const wordMap = {
      'one': 1, 'first': 1,
      'two': 2, 'second': 2,
      'three': 3, 'third': 3,
      'four': 4, 'fourth': 4,
      'five': 5, 'fifth': 5
    };

    for (const [word, num] of Object.entries(wordMap)) {
      if (text.includes(word)) {
        return num;
      }
    }

    return null;
  }

  /**
   * Parse RSS feed
   * @private
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
      console.error('[NewsPluginV2] Failed to fetch feed:', error);
      return [];
    }
  }

  /**
   * Clean HTML from text
   * @private
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
   * @private
   */
  createSummary(description) {
    const cleaned = this.cleanHtml(description);
    if (cleaned.length <= 100) return cleaned;
    return cleaned.substring(0, 100) + '...';
  }

  /**
   * Fetch full article content from BBC article page
   * @private
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
      let content = '';

      const articleBody = doc.querySelector('[data-component="text-block"]') ||
                         doc.querySelector('article') ||
                         doc.querySelector('.article__body') ||
                         doc.querySelector('.story-body');

      if (articleBody) {
        const paragraphs = articleBody.querySelectorAll('p');
        content = Array.from(paragraphs)
          .map(p => p.textContent.trim())
          .filter(text => text.length > 20)
          .join(' ');
      }

      return content.length > 100 ? content : null;

    } catch (error) {
      console.error('[NewsPluginV2] Failed to fetch article content:', error);
      return null;
    }
  }

  /**
   * Get cached articles or fetch new ones
   * @private
   */
  async getArticles(feedKey = 'bbc_world') {
    const now = Date.now();

    // Return cached if still valid
    if (this.cachedArticles.length > 0 &&
        this.cacheTimestamp &&
        (now - this.cacheTimestamp) < this.cacheDuration) {
      console.log('[NewsPluginV2] Using cached articles');
      return this.cachedArticles;
    }

    // Fetch fresh articles
    console.log('[NewsPluginV2] Fetching fresh articles from:', feedKey);
    const feedUrl = this.feeds[feedKey] || this.feeds.bbc_world;
    const articles = await this.fetchFeed(feedUrl);

    // Update cache
    this.cachedArticles = articles;
    this.cacheTimestamp = now;

    return articles;
  }
}

// Export singleton instance
export const newsPluginV2 = new NewsPluginV2();
export default NewsPluginV2;
