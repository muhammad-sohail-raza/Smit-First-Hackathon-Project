/**
 * HCM LITE — Leave Management Module
 * Enforces calendar working-day counting, overlap prevention,
 * annual quota bounds, admin review workflows, and employee history.
 */

// Selected leave request ID currently open in Admin review modal
let currentReviewLeaveId = null;

/**
 * Leave record schema in hcm_leaves:
 * {
 *   id: string,
 *   employeeId: string,
 *   leaveType: string ('Casual' | 'Sick' | 'Annual' | 'Unpaid'),
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   workingDays: number,
 *   reason: string,
 *   status: string ('Pending' | 'Approved' | 'Rejected'),
 *   adminComment: string,
 *   appliedOn: string (YYYY-MM-DD),
 *   reviewedAt: string|null
 * }
 */

/**
 * Calculate total approved leave working days for an employee in a given year
 * @param {string} employeeId
 * @param {number} [year]
 * @returns {number}
 */
function getEmployeeApprovedLeaveDays(employeeId, year = new Date().getFullYear()) {
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  return leaves
    .filter(l => {
      if (l.employeeId !== employeeId || l.status !== 'Approved') return false;
      const startYear = parseInt(l.startDate.substring(0, 4), 10);
      return startYear === year;
    })
    .reduce((sum, l) => sum + (l.workingDays || 0), 0);
}

/**
 * Check if a date range overlaps with existing pending or approved leaves for an employee
 * @param {string} employeeId
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @param {string} [excludeLeaveId]
 * @returns {boolean}
 */
function checkLeaveOverlap(employeeId, startDateStr, endDateStr, excludeLeaveId = null) {
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  return leaves.some(l => {
    if (l.employeeId !== employeeId) return false;
    if (excludeLeaveId && l.id === excludeLeaveId) return false;
    if (l.status === 'Rejected') return false; // Rejected leaves do not block dates

    // Overlap condition: startA <= endB && endA >= startB
    return (startDateStr <= l.endDate && endDateStr >= l.startDate);
  });
}

/**
 * Submit an Employee Leave Request
 * @param {string} employeeId
 * @param {Object} formData
 * @returns {{success: boolean, message: string, leave?: Object}}
 */
function submitLeaveRequest(employeeId, formData) {
  const { leaveType, fromDate, toDate, reason } = formData;

  if (!leaveType) {
    return { success: false, message: 'Please select a leave category.' };
  }
  if (!fromDate || !toDate) {
    return { success: false, message: 'Both start date and end date are required.' };
  }
  if (fromDate > toDate) {
    return { success: false, message: 'Start date cannot be after end date.' };
  }

  const startYear = parseInt(fromDate.substring(0, 4), 10);
  const endYear = parseInt(toDate.substring(0, 4), 10);
  if (startYear !== endYear) {
    return { success: false, message: 'Leave requests cannot span across calendar years. Please submit separate requests for each year.' };
  }

  const company = getCompanyConfig();
  const workingDaysList = company.workingDays || [1, 2, 3, 4, 5];
  const workingDays = countWorkingDaysInRange(fromDate, toDate, workingDaysList);

  if (workingDays === 0) {
    return { success: false, message: 'The selected period contains zero working days based on the company workweek schedule.' };
  }

  // Check overlap with pending or approved requests
  if (checkLeaveOverlap(employeeId, fromDate, toDate)) {
    return { success: false, message: 'You already have a pending or approved leave request during this date range.' };
  }

  // Check annual quota balance (unless leave is specifically Unpaid)
  const quota = parseInt(company.yearlyLeaveQuota || 20, 10);
  const approvedSoFar = getEmployeeApprovedLeaveDays(employeeId, startYear);
  const remaining = Math.max(0, quota - approvedSoFar);

  if (leaveType !== 'Unpaid' && workingDays > remaining) {
    return {
      success: false,
      message: `Requested duration (${workingDays} working days) exceeds your remaining annual leave balance (${remaining} days).`
    };
  }

  const newLeave = {
    id: generateId('LV'),
    employeeId: employeeId,
    leaveType: leaveType,
    startDate: fromDate,
    endDate: toDate,
    workingDays: workingDays,
    reason: (reason || '').trim(),
    status: 'Pending',
    adminComment: '',
    appliedOn: getLocalDateString(),
    reviewedAt: null
  };

  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  leaves.push(newLeave);
  setStorage(STORAGE_KEYS.LEAVES, leaves);

  return { success: true, message: `Leave request for ${workingDays} working days submitted successfully for approval.`, leave: newLeave };
}

/**
 * Review (Approve or Reject) a Leave Request (Admin Action)
 * @param {string} leaveId
 * @param {'Approved' | 'Rejected'} decision
 * @param {string} adminComment
 * @returns {{success: boolean, message: string}}
 */
function reviewLeaveRequest(leaveId, decision, adminComment = '') {
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  const index = leaves.findIndex(l => l.id === leaveId);

  if (index === -1) {
    return { success: false, message: 'Leave record not found.' };
  }

  const leave = leaves[index];
  if (leave.status !== 'Pending') {
    return { success: false, message: `This leave request has already been ${leave.status.toLowerCase()}.` };
  }

  if (decision === 'Approved') {
    // Re-verify quota at moment of approval
    const company = getCompanyConfig();
    const quota = parseInt(company.yearlyLeaveQuota || 20, 10);
    const startYear = parseInt(leave.startDate.substring(0, 4), 10);
    const approvedSoFar = getEmployeeApprovedLeaveDays(leave.employeeId, startYear);
    const remaining = Math.max(0, quota - approvedSoFar);

    if (leave.leaveType !== 'Unpaid' && leave.workingDays > remaining) {
      return {
        success: false,
        message: `Cannot approve request: Required days (${leave.workingDays}) exceed employee's remaining quota balance (${remaining} days).`
      };
    }
  }

  leave.status = decision;
  leave.adminComment = adminComment.trim();
  leave.reviewedAt = new Date().toISOString();

  leaves[index] = leave;
  setStorage(STORAGE_KEYS.LEAVES, leaves);

  return { success: true, message: `Leave application successfully ${decision.toLowerCase()}.` };
}

/**
 * Render Leave Requests Management Table & Summary Metrics (Admin Page)
 */
function renderAdminLeavesPage() {
  const tableBody = document.getElementById('leaveRequestsTableBody');
  if (!tableBody) return;

  const statusFilter = document.getElementById('leaveStatusFilter')?.value || '';
  const typeFilter = document.getElementById('leaveTypeFilter')?.value || '';
  const dateFilter = document.getElementById('leaveDateFilter')?.value || '';
  const countBadge = document.getElementById('leavesCountBadge');

  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  const users = getStorage(STORAGE_KEYS.USERS, []);

  // Filter leaves
  const filtered = leaves.filter(l => {
    const matchesStatus = !statusFilter || l.status === statusFilter;
    const matchesType = !typeFilter || l.leaveType === typeFilter;
    const matchesDate = !dateFilter || (dateFilter >= l.startDate && dateFilter <= l.endDate) || l.appliedOn === dateFilter;
    return matchesStatus && matchesType && matchesDate;
  }).sort((a, b) => (b.appliedOn > a.appliedOn ? 1 : -1));

  // Update badge count
  if (countBadge) {
    countBadge.textContent = `${filtered.length} Request${filtered.length === 1 ? '' : 's'} in Queue`;
  }

  // Update KPI Summary Metrics
  const pendingCount = leaves.filter(l => l.status === 'Pending').length;
  const approvedCount = leaves.filter(l => l.status === 'Approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'Rejected').length;

  const metricPending = document.getElementById('metricPendingLeaves');
  const metricApproved = document.getElementById('metricApprovedLeaves');
  const metricRejected = document.getElementById('metricRejectedLeaves');

  if (metricPending) metricPending.textContent = pendingCount;
  if (metricApproved) metricApproved.textContent = approvedCount;
  if (metricRejected) metricRejected.textContent = rejectedCount;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 0;">
          <div class="empty-state" id="leaveRequestsEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No leave requests found</h4>
            <p class="empty-state-desc">
              ${statusFilter || typeFilter || dateFilter ? 'No leave records match your current filter settings.' : 'Leave requests submitted by employees will appear here in chronological order for review and decision.'}
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  filtered.forEach(l => {
    const emp = users.find(u => u.id === l.employeeId) || { fullName: 'Unknown', department: '—' };
    const initials = (emp.fullName || 'E')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    let badgeClass = 'badge-warning';
    if (l.status === 'Approved') badgeClass = 'badge-success';
    if (l.status === 'Rejected') badgeClass = 'badge-danger';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="table-user-cell">
          <div class="user-avatar" style="background: var(--grad-primary);">${initials}</div>
          <div>
            <div class="user-name" style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(emp.fullName)}</div>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(emp.department || l.employeeId)}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-neutral">${escapeHtml(l.leaveType)}</span></td>
      <td>${formatDisplayDate(l.startDate)}</td>
      <td>${formatDisplayDate(l.endDate)}</td>
      <td style="font-weight: 600;">${l.workingDays} day${l.workingDays === 1 ? '' : 's'}</td>
      <td style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">${formatDisplayDate(l.appliedOn)}</td>
      <td><span class="badge ${badgeClass}">${l.status}</span></td>
      <td style="text-align: right;">
        <button type="button" class="btn btn-sm ${l.status === 'Pending' ? 'btn-primary' : 'btn-ghost'} review-leave-btn" data-id="${escapeHtml(l.id)}">
          ${l.status === 'Pending' ? 'Review' : 'View'}
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Attach modal review triggers
  tableBody.querySelectorAll('.review-leave-btn').forEach(btn => {
    btn.addEventListener('click', () => openLeaveReviewModal(btn.dataset.id));
  });
}

/**
 * Open Leave Review Modal with target leave details
 * @param {string} leaveId
 */
function openLeaveReviewModal(leaveId) {
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  const leave = leaves.find(l => l.id === leaveId);
  if (!leave) return;

  currentReviewLeaveId = leave.id;
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const emp = users.find(u => u.id === leave.employeeId) || { fullName: 'Unknown', department: '—', id: leave.employeeId };

  // Set modal fields
  const applicantName = document.getElementById('reviewApplicantName');
  const applicantDept = document.getElementById('reviewApplicantDept');
  const leaveStatusBadge = document.getElementById('reviewLeaveStatus');
  const leaveType = document.getElementById('reviewLeaveType');
  const dateRange = document.getElementById('reviewDateRange');
  const workingDays = document.getElementById('reviewWorkingDaysCount');
  const reasonBox = document.getElementById('reviewApplicantReason');
  const commentInput = document.getElementById('adminLeaveComment');
  const feedback = document.getElementById('reviewFeedback');

  if (applicantName) applicantName.textContent = emp.fullName;
  if (applicantDept) applicantDept.textContent = `${emp.department || 'Staff'} · ${emp.id}`;

  if (leaveStatusBadge) {
    let badgeClass = 'badge-warning';
    if (leave.status === 'Approved') badgeClass = 'badge-success';
    if (leave.status === 'Rejected') badgeClass = 'badge-danger';
    leaveStatusBadge.className = `badge ${badgeClass}`;
    leaveStatusBadge.textContent = leave.status;
  }

  if (leaveType) leaveType.textContent = leave.leaveType;
  if (dateRange) dateRange.textContent = `${formatDisplayDate(leave.startDate)} to ${formatDisplayDate(leave.endDate)}`;
  if (workingDays) workingDays.textContent = `${leave.workingDays} working days`;
  if (reasonBox) reasonBox.textContent = leave.reason || 'No reason provided by applicant.';
  if (commentInput) {
    commentInput.value = leave.adminComment || '';
    commentInput.disabled = leave.status !== 'Pending';
  }
  if (feedback) feedback.textContent = '';

  const approveBtn = document.getElementById('approveLeaveBtn');
  const rejectBtn = document.getElementById('rejectLeaveBtn');

  if (approveBtn) approveBtn.style.display = leave.status === 'Pending' ? 'inline-flex' : 'none';
  if (rejectBtn) rejectBtn.style.display = leave.status === 'Pending' ? 'inline-flex' : 'none';

  window.location.hash = 'reviewLeaveModal';
}

/**
 * Close Review Modal
 */
function closeLeaveReviewModal() {
  window.location.hash = '';
  currentReviewLeaveId = null;
}

/**
 * Render Employee's My Leaves Table (Employee Page)
 * @param {string} employeeId
 */
function renderMyLeavesTable(employeeId) {
  const tableBody = document.getElementById('myLeavesTableBody');
  if (!tableBody) return;

  const leaves = getStorage(STORAGE_KEYS.LEAVES, [])
    .filter(l => l.employeeId === employeeId)
    .sort((a, b) => (b.appliedOn > a.appliedOn ? 1 : -1));

  if (leaves.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state" id="myLeavesEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No leave requests</h4>
            <p class="empty-state-desc">
              Your submitted leave applications and approval statuses will appear here.
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  leaves.forEach(l => {
    let badgeClass = 'badge-warning';
    if (l.status === 'Approved') badgeClass = 'badge-success';
    if (l.status === 'Rejected') badgeClass = 'badge-danger';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge badge-neutral">${escapeHtml(l.leaveType)}</span></td>
      <td>${formatDisplayDate(l.startDate)} – ${formatDisplayDate(l.endDate)}</td>
      <td style="font-weight: 600;">${l.workingDays} day${l.workingDays === 1 ? '' : 's'}</td>
      <td><span class="badge ${badgeClass}">${l.status}</span></td>
      <td style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">
        ${l.adminComment ? escapeHtml(l.adminComment) : '<em style="color: var(--color-text-muted);">No comments</em>'}
      </td>
    `;
    tableBody.appendChild(tr);
  });
}
