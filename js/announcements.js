/**
 * HCM LITE — Company Announcements Module
 * Allows administrators to broadcast organization notices and employees to view them.
 */

/**
 * Announcement Schema in hcm_announcements:
 * {
 *   id: string,
 *   title: string,
 *   message: string,
 *   authorName: string,
 *   authorId: string,
 *   createdAt: string (ISO string)
 * }
 */

/**
 * Get all announcements, newest first
 * @returns {Array}
 */
function getAnnouncements() {
  const list = getStorage(STORAGE_KEYS.ANNOUNCEMENTS, []);
  return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

/**
 * Create a new announcement (Admin only)
 * @param {string} title
 * @param {string} message
 * @param {Object} authorUser
 * @returns {{success: boolean, message: string}}
 */
function createAnnouncement(title, message, authorUser) {
  if (!title || !title.trim()) {
    return { success: false, message: 'Announcement title is required.' };
  }
  if (!message || !message.trim()) {
    return { success: false, message: 'Announcement message cannot be empty.' };
  }

  const newNotice = {
    id: generateId('ANN'),
    title: title.trim(),
    message: message.trim(),
    authorName: authorUser ? authorUser.fullName : 'System Administrator',
    authorId: authorUser ? authorUser.id : 'ADM',
    createdAt: new Date().toISOString()
  };

  const list = getStorage(STORAGE_KEYS.ANNOUNCEMENTS, []);
  list.push(newNotice);
  setStorage(STORAGE_KEYS.ANNOUNCEMENTS, list);

  return { success: true, message: 'Notice broadcasted successfully.' };
}

/**
 * Delete announcement (Admin only)
 * @param {string} announcementId
 */
function deleteAnnouncement(announcementId) {
  if (!confirm('Are you sure you want to remove this announcement?')) return;
  const list = getStorage(STORAGE_KEYS.ANNOUNCEMENTS, []);
  const updated = list.filter(a => a.id !== announcementId);
  setStorage(STORAGE_KEYS.ANNOUNCEMENTS, updated);
  renderAnnouncements();
}

/**
 * Render announcements in the card body
 * @param {boolean} [isAdmin=false]
 */
function renderAnnouncements(isAdmin = false) {
  // Target container on admin or employee page
  const container = document.querySelector('#announcements .card-body');
  if (!container) return;

  const list = getAnnouncements();

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" id="${isAdmin ? 'announcementsEmptyState' : 'empAnnouncementsEmptyState'}" style="padding: var(--space-6) 0;">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <h4 class="empty-state-title">No announcements yet</h4>
        <p class="empty-state-desc">
          ${isAdmin
            ? 'Company-wide notices, holiday schedules, and workplace policies posted here will be immediately visible on all employee dashboards.'
            : 'When management posts company updates or holiday calendars, they will appear here.'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  list.forEach(a => {
    const item = document.createElement('article');
    item.style.cssText = 'background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); position: relative;';

    const dateFormatted = new Date(a.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <h4 style="font-size: var(--font-size-base); font-weight: 600; color: var(--color-text-main); margin-bottom: 4px;">
          ${escapeHtml(a.title)}
        </h4>
        ${isAdmin ? `
          <button type="button" class="btn btn-sm btn-ghost delete-announcement-btn" data-id="${escapeHtml(a.id)}" title="Delete Notice" style="color: var(--color-error); padding: 2px 6px;">
            &times;
          </button>
        ` : ''}
      </div>
      <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
        ${escapeHtml(a.message)}
      </p>
      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-muted); border-top: 1px dashed var(--color-border); padding-top: 6px;">
        <span>Posted by <strong>${escapeHtml(a.authorName || 'HR Management')}</strong></span>
        <span>${dateFormatted}</span>
      </div>
    `;
    wrapper.appendChild(item);
  });

  container.appendChild(wrapper);

  // Wire delete buttons for admin
  if (isAdmin) {
    container.querySelectorAll('.delete-announcement-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteAnnouncement(btn.dataset.id));
    });
  }
}

/**
 * Initialize Announcements Event Listeners
 * @param {Object} currentUser
 */
function initAnnouncements(currentUser) {
  const isAdmin = currentUser && currentUser.role === 'admin';
  renderAnnouncements(isAdmin);

  if (isAdmin) {
    const postBtn = document.getElementById('postAnnouncementBtn');
    if (postBtn) {
      postBtn.addEventListener('click', () => {
        const title = prompt('Enter Announcement Headline / Title:');
        if (!title || !title.trim()) return;
        const message = prompt('Enter Announcement Message Details:');
        if (!message || !message.trim()) return;

        createAnnouncement(title, message, currentUser);
        renderAnnouncements(true);
      });
    }
  }
}
