import { LitElement, html, css } from 'lit';
import { db, completeReminder } from '../services/db-service.js';

/**
 * Medication Reminder Component
 * Displays upcoming medications and hydration reminders
 */
class MedicationReminder extends LitElement {
  static properties = {
    profile: { type: Object },
    activeReminders: { type: Array },
    nextReminder: { type: Object }
  };

  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--spacing);
    }

    .reminder-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: var(--spacing);
      box-shadow: var(--shadow);
      border-left: 4px solid var(--primary);
    }

    .reminder-card.urgent {
      border-left-color: var(--error);
      animation: pulse-border 2s ease-in-out infinite;
    }

    @keyframes pulse-border {
      0%, 100% { border-left-width: 4px; }
      50% { border-left-width: 8px; }
    }

    .reminder-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: var(--spacing);
      color: var(--text);
    }

    .reminder-icon {
      font-size: 1.5rem;
    }

    .reminder-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing);
    }

    .reminder-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing);
      background: var(--bg);
      border-radius: var(--radius);
      font-size: 1.125rem;
    }

    .reminder-details {
      flex: 1;
    }

    .medication-name {
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.25rem;
    }

    .medication-info {
      color: var(--text-light);
      font-size: 0.875rem;
    }

    .time-badge {
      background: var(--primary);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: calc(var(--radius) / 2);
      font-weight: 600;
      font-size: 1rem;
    }

    .time-badge.due {
      background: var(--error);
    }

    .complete-button {
      background: var(--success);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-size: 1rem;
      cursor: pointer;
      margin-top: 0.5rem;
      font-weight: 600;
    }

    .complete-button:hover {
      opacity: 0.9;
    }

    .no-reminders {
      text-align: center;
      color: var(--text-light);
      padding: 2rem;
      font-size: 1rem;
    }
  `;

  constructor() {
    super();
    this.profile = null;
    this.activeReminders = [];
    this.nextReminder = null;
    this.checkInterval = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startReminderCheck();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('profile') && this.profile) {
      this.generateReminders();
    }
  }

  async generateReminders() {
    if (!this.profile?.medications) {
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Generate reminders for medications scheduled today
    for (const med of this.profile.medications) {
      const scheduledTime = new Date(`${today}T${med.time}`);

      // Only create if not already in database and is future
      if (scheduledTime > now) {
        const exists = await db.reminders
          .where(['type', 'scheduledFor'])
          .equals(['medication', scheduledTime])
          .first();

        if (!exists) {
          await db.reminders.add({
            type: 'medication',
            scheduledFor: scheduledTime,
            completed: false,
            data: med
          });
        }
      }
    }

    await this.loadActiveReminders();
  }

  async loadActiveReminders() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    this.activeReminders = await db.reminders
      .where('scheduledFor')
      .between(now, endOfDay)
      .and(reminder => !reminder.completed)
      .sortBy('scheduledFor');

    this.nextReminder = this.activeReminders[0] || null;
  }

  startReminderCheck() {
    // Check every minute
    this.checkInterval = setInterval(() => {
      this.loadActiveReminders();
      this.checkDueReminders();
    }, 60000);

    // Initial check
    this.loadActiveReminders();
    this.checkDueReminders();
  }

  async checkDueReminders() {
    const now = new Date();

    for (const reminder of this.activeReminders) {
      if (reminder.scheduledFor <= now && !reminder.notified) {
        this.notifyReminder(reminder);
        await db.reminders.update(reminder.id, { notified: true });
      }
    }
  }

  notifyReminder(reminder) {
    const message = reminder.type === 'medication'
      ? `Time for your medication: ${reminder.data.name}`
      : `Reminder: ${reminder.data.message}`;

    // Visual notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('ADAM Reminder', {
        body: message,
        icon: '/icons/icon-192.png'
      });
    }

    // Audio notification (TTS)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }

  async handleComplete(reminderId) {
    await completeReminder(reminderId);
    await this.loadActiveReminders();
  }

  getTimeUntil(scheduledTime) {
    const now = new Date();
    const diff = scheduledTime - now;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (diff < 0) {
      return 'DUE NOW';
    } else if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    } else {
      return `in ${minutes}m`;
    }
  }

  isDue(scheduledTime) {
    return scheduledTime <= new Date();
  }

  render() {
    if (!this.activeReminders || this.activeReminders.length === 0) {
      return html`
        <div class="reminder-card">
          <div class="reminder-header">
            <span class="reminder-icon">✅</span>
            <span>Reminders</span>
          </div>
          <div class="no-reminders">
            No reminders scheduled for today
          </div>
        </div>
      `;
    }

    return html`
      <div class="reminder-card ${this.isDue(this.nextReminder?.scheduledFor) ? 'urgent' : ''}">
        <div class="reminder-header">
          <span class="reminder-icon">💊</span>
          <span>Upcoming Reminders</span>
        </div>

        <div class="reminder-list">
          ${this.activeReminders.map(reminder => html`
            <div class="reminder-item">
              <div class="reminder-details">
                <div class="medication-name">
                  ${reminder.data?.name || 'Reminder'}
                </div>
                <div class="medication-info">
                  ${reminder.data?.dosage || ''} ${reminder.data?.notes ? `- ${reminder.data.notes}` : ''}
                </div>
                ${this.isDue(reminder.scheduledFor) ? html`
                  <button
                    class="complete-button"
                    @click=${() => this.handleComplete(reminder.id)}
                  >
                    ✓ Mark as Taken
                  </button>
                ` : ''}
              </div>

              <div class="time-badge ${this.isDue(reminder.scheduledFor) ? 'due' : ''}">
                ${this.getTimeUntil(reminder.scheduledFor)}
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

customElements.define('medication-reminder', MedicationReminder);
