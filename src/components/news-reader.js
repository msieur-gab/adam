/**
 * News Reader Component
 * Visual display for news headlines and articles
 */

import { LitElement, html, css } from 'lit';
import { newsReaderPlugin } from '../plugins/news-reader-plugin.js';

class NewsReader extends LitElement {
  static properties = {
    articles: { type: Array },
    loading: { type: Boolean },
    selectedArticle: { type: Object },
    error: { type: String }
  };

  static styles = css`
    :host {
      display: block;
      background: var(--surface);
      border-radius: var(--radius);
      padding: var(--spacing);
      margin: var(--spacing) 0;
      box-shadow: var(--shadow);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing);
      padding-bottom: var(--spacing);
      border-bottom: 2px solid var(--primary-light);
    }

    .title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .close-btn {
      background: var(--text-light);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 0.875rem;
    }

    .close-btn:hover {
      background: var(--text);
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--text-light);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--primary-light);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .headlines {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .headline {
      padding: 1rem;
      background: var(--bg);
      border-radius: var(--radius);
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }

    .headline:hover {
      border-color: var(--primary);
      background: var(--primary-light);
    }

    .headline-number {
      display: inline-block;
      background: var(--primary);
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      text-align: center;
      line-height: 32px;
      font-weight: 600;
      margin-right: 1rem;
    }

    .headline-title {
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 0.5rem;
    }

    .headline-summary {
      font-size: 0.875rem;
      color: var(--text-light);
      line-height: 1.5;
    }

    .article-view {
      background: var(--bg);
      border-radius: var(--radius);
      padding: 1.5rem;
    }

    .article-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--primary-light);
    }

    .article-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.5rem;
    }

    .article-meta {
      font-size: 0.875rem;
      color: var(--text-light);
    }

    .article-content {
      font-size: 1rem;
      line-height: 1.8;
      color: var(--text);
    }

    .article-link {
      display: inline-block;
      margin-top: 1rem;
      color: var(--primary);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .article-link:hover {
      text-decoration: underline;
    }

    .back-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      cursor: pointer;
      margin-bottom: 1rem;
    }

    .back-btn:hover {
      opacity: 0.9;
    }

    .error {
      padding: 1rem;
      background: #fee;
      border: 2px solid #fcc;
      border-radius: var(--radius);
      color: #c33;
    }

    .voice-hint {
      background: var(--primary-light);
      padding: 0.75rem;
      border-radius: var(--radius);
      margin-top: 1rem;
      font-size: 0.875rem;
      color: var(--text);
      text-align: center;
    }
  `;

  constructor() {
    super();
    this.articles = [];
    this.loading = true;
    this.selectedArticle = null;
    this.error = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.loadHeadlines();
  }

  async loadHeadlines() {
    this.loading = true;
    this.error = null;

    try {
      const result = await newsReaderPlugin.handleQuery('news_headlines', {});

      if (result.success) {
        this.articles = result.articles;
      } else {
        this.error = result.error || 'Failed to load news';
      }
    } catch (err) {
      console.error('[NewsReader] Failed to load headlines:', err);
      this.error = 'Could not connect to news service';
    } finally {
      this.loading = false;
    }
  }

  async selectArticle(article) {
    this.selectedArticle = article;

    // Notify parent that article was selected
    this.dispatchEvent(new CustomEvent('article-selected', {
      detail: { article },
      bubbles: true,
      composed: true
    }));
  }

  backToHeadlines() {
    this.selectedArticle = null;

    // Notify parent
    this.dispatchEvent(new CustomEvent('back-to-headlines', {
      bubbles: true,
      composed: true
    }));
  }

  close() {
    // Notify parent to close the component
    this.dispatchEvent(new CustomEvent('close-news-reader', {
      bubbles: true,
      composed: true
    }));
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  render() {
    return html`
      <div class="header">
        <div class="title">
          📰 News Reader
        </div>
        <button class="close-btn" @click=${this.close}>Close</button>
      </div>

      ${this.loading ? html`
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading latest headlines...</p>
        </div>
      ` : this.error ? html`
        <div class="error">
          <p>⚠️ ${this.error}</p>
        </div>
      ` : this.selectedArticle ? this.renderArticle() : this.renderHeadlines()}
    `;
  }

  renderHeadlines() {
    return html`
      <div class="headlines">
        ${this.articles.map(article => html`
          <div class="headline" @click=${() => this.selectArticle(article)}>
            <span class="headline-number">${article.number}</span>
            <div style="display: inline-block; vertical-align: top; width: calc(100% - 48px);">
              <div class="headline-title">${article.title}</div>
              <div class="headline-summary">${article.summary}</div>
            </div>
          </div>
        `)}
      </div>

      <div class="voice-hint">
        💬 Say "read article number 1" or click any headline to read the full article
      </div>
    `;
  }

  renderArticle() {
    return html`
      <button class="back-btn" @click=${this.backToHeadlines}>
        ← Back to Headlines
      </button>

      <div class="article-view">
        <div class="article-header">
          <div class="article-title">${this.selectedArticle.title}</div>
          <div class="article-meta">
            Published: ${this.formatDate(this.selectedArticle.pubDate)}
          </div>
        </div>

        <div class="article-content">
          ${this.selectedArticle.description}
        </div>

        <a
          href="${this.selectedArticle.link}"
          target="_blank"
          class="article-link"
        >
          Read full article on BBC News →
        </a>
      </div>

      <div class="voice-hint">
        💬 Say "back to headlines" to see other articles
      </div>
    `;
  }
}

customElements.define('news-reader', NewsReader);
