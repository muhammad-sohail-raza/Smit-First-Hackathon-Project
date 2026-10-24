/**
 * HCM LITE — Master Application Orchestrator
 * Bootstraps authentication, routing, page controllers, form events,
 * and responsive navigation across all seven views.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile drawer toggle setup
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const sidebar = document.getElementById('sidebarNav');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', (e) => {
      e.preventDefault();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  const currentPath = window.location.pathname;

  // 1. ROUTE: Login & Setup Page (index.html or root /)
  if (currentPath.endsWith('index.html') || currentPath.endsWith('/') || !currentPath.includes('/pages/')) {
    initAuthPage();
    return;
  }

  // 2. ROUTE: Admin Dashboard (pages/admin.html)
  if (currentPath.includes('admin.html')) {
    const user = requireAuth(['admin']);
    if (user) initAdminDashboard(user);
    return;
  }

  // 3. ROUTE: Employee Directory & Management (pages/employees.html)
  if (currentPath.includes('employees.html')) {
    const user = requireAuth(['admin']);
    if (user) initEmployeePage();
    return;
  }

  // 4. ROUTE: Leave Management (pages/leaves.html)
  if (currentPath.includes('leaves.html')) {
    const user = requireAuth(['admin']);
    if (user) initLeavesPage();
    return;
  }

  // 5. ROUTE: Company Settings (pages/settings.html)
  if (currentPath.includes('settings.html')) {
    const user = requireAuth(['admin']);
    if (user) initSettingsPage();
    return;
  }

  // 6. ROUTE: Employee Self-Service Dashboard (pages/employee.html)
  if (currentPath.includes('employee.html')) {
    // Both employee and admin (for preview) can view
    const user = requireAuth(['employee', 'admin']);
    if (user) initEmployeeDashboard(user);
    return;
  }

  // 7. ROUTE: Monthly Salary Slip (pages/payslip.html)
  if (currentPath.includes('payslip.html')) {
    const user = requireAuth(['admin', 'employee']);
    if (user) initPayslipPage(user);
    return;
  }
});

/**
 * =========================================================================
 * 1. LOGIN & FIRST-RUN SETUP CONTROLLER (index.html)
 * =========================================================================
 */
function initAuthPage() {
  const loginForm = document.getElementById('loginForm');
  const setupForm = document.getElementById('setupForm');
  const loginFeedback = document.getElementById('loginFeedback');
  const setupFeedback = document.getElementById('setupFeedback');
  const tabSignIn = document.getElementById('tabSignInLink');
  const tabSetup = document.getElementById('tabSetupLink');

  // Check if first-run setup is required
  const hasAdmin = hasConfiguredAdmin();
  if (!hasAdmin) {
    // Switch to first-run setup view
    window.location.hash = 'first-run-setup';
    if (tabSetup && tabSignIn) {
      tabSetup.classList.add('active-login');
      tabSignIn.classList.remove('active-login');
    }
  } else {
    // Already configured; switch to sign in view
    if (window.location.hash === '#first-run-setup') {
      window.location.hash = 'sign-in-view';
    }
    if (tabSignIn && tabSetup) {
      tabSignIn.classList.add('active-login');
      tabSetup.classList.remove('active-login');
    }
  }

  // Tab switching clicks
  if (tabSignIn) {
    tabSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'sign-in-view';
      tabSignIn.classList.add('active-login');
      if (tabSetup) tabSetup.classList.remove('active-login');
      document.getElementById('login-tab-content').style.display = 'block';
      document.getElementById('setup-tab-content').style.display = 'none';
    });
  }

  if (tabSetup) {
    tabSetup.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'first-run-setup';
      tabSetup.classList.add('active-login');
      if (tabSignIn) tabSignIn.classList.remove('active-login');
      document.getElementById('login-tab-content').style.display = 'none';
      document.getElementById('setup-tab-content').style.display = 'block';
    });
  }

  // If hash is already set
  if (window.location.hash === '#first-run-setup' || !hasAdmin) {
    const loginContent = document.getElementById('login-tab-content');
    const setupContent = document.getElementById('setup-tab-content');
    if (loginContent) loginContent.style.display = 'none';
    if (setupContent) setupContent.style.display = 'block';
  }

  // LOGIN FORM SUBMISSION
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginFeedback) {
        loginFeedback.textContent = '';
        loginFeedback.className = 'form-feedback';
      }

      const email = document.getElementById('loginEmail')?.value;
      const password = document.getElementById('loginPassword')?.value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await loginUser(email, password);
        if (result.success) {
          if (loginFeedback) {
            loginFeedback.textContent = 'Sign in successful! Redirecting...';
            loginFeedback.style.color = 'var(--color-success)';
          }
          setTimeout(() => {
            if (result.user.role === 'admin') {
              window.location.href = 'pages/admin.html';
            } else {
              window.location.href = 'pages/employee.html';
            }
          }, 400);
        } else {
          if (loginFeedback) {
            loginFeedback.textContent = result.message;
            loginFeedback.style.color = 'var(--color-error)';
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        if (loginFeedback) {
          loginFeedback.textContent = 'An unexpected authentication error occurred.';
          loginFeedback.style.color = 'var(--color-error)';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // SETUP FORM SUBMISSION
  if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (setupFeedback) {
        setupFeedback.textContent = '';
        setupFeedback.className = 'form-feedback';
      }

      const companyName = document.getElementById('setupCompanyName')?.value;
      const adminName = document.getElementById('setupAdminName')?.value;
      const adminEmail = document.getElementById('setupAdminEmail')?.value;
      const adminPassword = document.getElementById('setupAdminPassword')?.value;
      const confirmPassword = document.getElementById('setupConfirmPassword')?.value;
      const submitBtn = document.getElementById('setupSubmitBtn');

      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await registerInitialAdmin({
          companyName,
          adminName,
          adminEmail,
          adminPassword,
          confirmPassword
        });

        if (result.success) {
          if (setupFeedback) {
            setupFeedback.textContent = 'Company and Admin created successfully! Initializing workspace...';
            setupFeedback.style.color = 'var(--color-success)';
          }
          setTimeout(() => {
            window.location.href = 'pages/admin.html';
          }, 500);
        } else {
          if (setupFeedback) {
            setupFeedback.textContent = result.message;
            setupFeedback.style.color = 'var(--color-error)';
          }
        }
      } catch (err) {
        console.error('Setup error:', err);
        if (setupFeedback) {
          setupFeedback.textContent = 'An unexpected error occurred during setup.';
          setupFeedback.style.color = 'var(--color-error)';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

/**
 * =========================================================================
 * 2. ADMIN DASHBOARD CONTROLLER (pages/admin.html)
 * =========================================================================
 */
function initAdminDashboard(currentUser) {
  // Update banner date badge
  const dateBadge = document.getElementById('currentDateBadge');
  if (dateBadge) {
    const today = new Date();
    const formatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const company = getCompanyConfig();
    const isWorkingDay = (company.workingDays || [1, 2, 3, 4, 5]).includes(today.getDay());
    dateBadge.querySelector('span').textContent = `${formatted} · ${isWorkingDay ? 'Working Day' : 'Non-Working Day'}`;
  }

  // Render today's attendance logs
  renderAdminTodayAttendance();

  // Render pending leaves card on dashboard
  renderAdminDashboardLeaves();

  // Initialize announcements
  initAnnouncements(currentUser);

  // Initialize Smart Helper
  initSmartHelper(currentUser);
}

/**
 * Render pending leaves summary on Admin dashboard
 */
function renderAdminDashboardLeaves() {
  const leavesCard = document.getElementById('pendingLeavesCard');
  if (!leavesCard) return;

  const cardBody = leavesCard.querySelector('.card-body');
  if (!cardBody) return;

  const leaves = getStorage(STORAGE_KEYS.LEAVES, []).filter(l => l.status === 'Pending');
  const users = getStorage(STORAGE_KEYS.USERS, []);

  if (leaves.length === 0) {
    cardBody.innerHTML = `
      <div class="empty-state" id="pendingLeavesEmptyState">
        <div class="empty-state-icon" style="background-color: var(--color-warning-bg); color: var(--color-warning);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h4 class="empty-state-title">No pending requests</h4>
        <p class="empty-state-desc">
          Employee leave applications requiring review will appear here. Approved leaves automatically deduct from employee balances.
        </p>
        <div class="empty-state-action">
          <a href="leaves.html" class="btn btn-sm btn-secondary">Review Leave Queue</a>
        </div>
      </div>
    `;
    return;
  }

  cardBody.innerHTML = '';
  const listWrapper = document.createElement('div');
  listWrapper.style.padding = 'var(--space-4)';
  listWrapper.style.display = 'flex';
  listWrapper.style.flexDirection = 'column';
  listWrapper.style.gap = 'var(--space-3)';

  leaves.slice(0, 4).forEach(l => {
    const emp = users.find(u => u.id === l.employeeId) || { fullName: 'Employee', department: '—' };
    const row = document.createElement('div');
    row.style.cssText = 'background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); display: flex; justify-content: space-between; align-items: center;';

    row.innerHTML = `
      <div>
        <strong style="color: var(--color-text-main); font-size: var(--font-size-sm);">${escapeHtml(emp.fullName)}</strong>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px;">
          ${escapeHtml(l.leaveType)} Leave · ${l.workingDays} working days (${formatDisplayDate(l.startDate)} - ${formatDisplayDate(l.endDate)})
        </div>
      </div>
      <a href="leaves.html#reviewLeaveModal" class="btn btn-sm btn-secondary" onclick="openLeaveReviewModal('${escapeHtml(l.id)}')">
        Review
      </a>
    `;
    listWrapper.appendChild(row);
  });

  cardBody.appendChild(listWrapper);
}

/**
 * =========================================================================
 * 3. LEAVES MANAGEMENT CONTROLLER (pages/leaves.html)
 * =========================================================================
 */
function initLeavesPage() {
  renderAdminLeavesPage();

  const statusFilter = document.getElementById('leaveStatusFilter');
  const typeFilter = document.getElementById('leaveTypeFilter');
  const dateFilter = document.getElementById('leaveDateFilter');

  if (statusFilter) statusFilter.addEventListener('change', renderAdminLeavesPage);
  if (typeFilter) typeFilter.addEventListener('change', renderAdminLeavesPage);
  if (dateFilter) dateFilter.addEventListener('change', renderAdminLeavesPage);

  // Review modal approve & reject actions
  const approveBtn = document.getElementById('approveLeaveBtn');
  const rejectBtn = document.getElementById('rejectLeaveBtn');
  const reviewForm = document.getElementById('reviewLeaveForm');
  const feedback = document.getElementById('reviewFeedback');

  if (approveBtn) {
    approveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentReviewLeaveId) return;
      const comment = document.getElementById('adminLeaveComment')?.value || '';
      const result = reviewLeaveRequest(currentReviewLeaveId, 'Approved', comment);
      if (result.success) {
        closeLeaveReviewModal();
        renderAdminLeavesPage();
      } else {
        if (feedback) {
          feedback.textContent = result.message;
          feedback.style.color = 'var(--color-error)';
        }
      }
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentReviewLeaveId) return;
      const comment = document.getElementById('adminLeaveComment')?.value || '';
      const result = reviewLeaveRequest(currentReviewLeaveId, 'Rejected', comment);
      if (result.success) {
        closeLeaveReviewModal();
        renderAdminLeavesPage();
      } else {
        if (feedback) {
          feedback.textContent = result.message;
          feedback.style.color = 'var(--color-error)';
        }
      }
    });
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => e.preventDefault());
  }
}

/**
 * =========================================================================
 * 4. COMPANY SETTINGS CONTROLLER (pages/settings.html)
 * =========================================================================
 */
function initSettingsPage() {
  const form = document.getElementById('settingsForm');
  const feedback = document.getElementById('settingsFeedback');
  if (feedback) feedback.textContent = '';

  const company = getCompanyConfig();

  // Populate inputs
  const nameInput = document.getElementById('companyName');
  const emailInput = document.getElementById('companyEmail');
  const addressInput = document.getElementById('companyAddress');
  const phoneInput = document.getElementById('companyPhone');
  const startTimeInput = document.getElementById('officeStartTime');
  const graceInput = document.getElementById('gracePeriod');
  const hoursInput = document.getElementById('dailyWorkHours');
  const quotaInput = document.getElementById('yearlyLeaveQuota');
  const policyInput = document.getElementById('leavePolicyDescription');

  if (nameInput) nameInput.value = company.name || '';
  if (emailInput) emailInput.value = company.email || '';
  if (addressInput) addressInput.value = company.address || '';
  if (phoneInput) phoneInput.value = company.phone || '';
  if (startTimeInput) startTimeInput.value = company.officeStartTime || '09:00';
  if (graceInput) graceInput.value = company.gracePeriod || 15;
  if (hoursInput) hoursInput.value = company.dailyWorkHours || 8;
  if (quotaInput) quotaInput.value = company.yearlyLeaveQuota || 20;
  if (policyInput) policyInput.value = company.leavePolicyDescription || '';

  // Working days checklist
  const workingDays = company.workingDays || [1, 2, 3, 4, 5];
  const dayValueMap = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  document.querySelectorAll('input[name="workingDays"]').forEach(cb => {
    const dayNum = dayValueMap[cb.value];
    cb.checked = workingDays.includes(dayNum);
  });

  // Handle Form Submit
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (feedback) feedback.textContent = '';

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const startTime = startTimeInput ? startTimeInput.value : '09:00';
      const grace = parseInt(graceInput ? graceInput.value : 15, 10);
      const hours = parseInt(hoursInput ? hoursInput.value : 8, 10);
      const quota = parseInt(quotaInput ? quotaInput.value : 20, 10);

      if (!name) {
        showSettingsError('Company name is required.');
        return;
      }
      if (!email) {
        showSettingsError('Company official email is required.');
        return;
      }
      if (!startTime) {
        showSettingsError('Office start time is required.');
        return;
      }
      if (isNaN(grace) || grace < 0) {
        showSettingsError('Grace period must be 0 or a positive number of minutes.');
        return;
      }
      if (isNaN(quota) || quota < 0) {
        showSettingsError('Yearly leave quota must be 0 or positive.');
        return;
      }

      // Collect checked working days
      const selectedDays = [];
      document.querySelectorAll('input[name="workingDays"]:checked').forEach(cb => {
        if (dayValueMap[cb.value] !== undefined) {
          selectedDays.push(dayValueMap[cb.value]);
        }
      });

      if (selectedDays.length === 0) {
        showSettingsError('Please select at least one working day of the week.');
        return;
      }

      // Save updated company config
      const updatedConfig = {
        ...company,
        name,
        email,
        address: addressInput ? addressInput.value.trim() : '',
        phone: phoneInput ? phoneInput.value.trim() : '',
        officeStartTime: startTime,
        gracePeriod: grace,
        dailyWorkHours: hours,
        workingDays: selectedDays,
        yearlyLeaveQuota: quota,
        leavePolicyDescription: policyInput ? policyInput.value.trim() : ''
      };

      setStorage(STORAGE_KEYS.COMPANY, updatedConfig);

      if (feedback) {
        feedback.textContent = 'Company settings saved successfully! Future attendance & leave calculations will reflect these changes.';
        feedback.style.color = 'var(--color-success)';
      }
    });
  }

  function showSettingsError(msg) {
    if (feedback) {
      feedback.textContent = msg;
      feedback.style.color = 'var(--color-error)';
    } else {
      alert(msg);
    }
  }
}

/**
 * =========================================================================
 * 5. EMPLOYEE DASHBOARD CONTROLLER (pages/employee.html)
 * =========================================================================
 */
function initEmployeeDashboard(currentUser) {
  // Update banner date badge
  const dateBadge = document.getElementById('empCurrentDateBadge');
  if (dateBadge) {
    const today = new Date();
    dateBadge.querySelector('span').textContent = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Quota badge
  const quotaBadge = document.getElementById('availableQuotaBadge');
  const now = new Date();
  const company = getCompanyConfig();
  const quota = company.yearlyLeaveQuota || 20;
  const approvedUsed = getEmployeeApprovedLeaveDays(currentUser.id, now.getFullYear());
  const remainingDays = Math.max(0, quota - approvedUsed);
  if (quotaBadge) {
    quotaBadge.textContent = `Available Balance: ${remainingDays} / ${quota} days`;
  }

  // Render Attendance Punch Card & Attendance Log
  renderEmployeeAttendanceDashboard(currentUser.id);

  // Wire Punch In & Punch Out Buttons
  const checkInBtn = document.getElementById('checkInButton');
  const checkOutBtn = document.getElementById('checkOutButton');

  if (checkInBtn) {
    checkInBtn.addEventListener('click', () => {
      const result = checkInEmployee(currentUser.id);
      alert(result.message);
      renderEmployeeAttendanceDashboard(currentUser.id);
    });
  }

  if (checkOutBtn) {
    checkOutBtn.addEventListener('click', () => {
      const result = checkOutEmployee(currentUser.id);
      alert(result.message);
      renderEmployeeAttendanceDashboard(currentUser.id);
    });
  }

  // Leave Application Form
  const fromDateInput = document.getElementById('leaveFromDate');
  const toDateInput = document.getElementById('leaveToDate');
  const calcWorkingDaysEl = document.getElementById('calcWorkingDays');
  const leaveForm = document.getElementById('leaveForm');
  const leaveFeedback = document.getElementById('leaveFeedback');

  function updateCalculatedDays() {
    if (!fromDateInput || !toDateInput || !calcWorkingDaysEl) return;
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;
    if (fromDate && toDate && fromDate <= toDate) {
      const workingDays = countWorkingDaysInRange(fromDate, toDate, company.workingDays || [1, 2, 3, 4, 5]);
      calcWorkingDaysEl.textContent = `Calculated Working Days: ${workingDays} (Weekends & non-working days excluded)`;
    } else {
      calcWorkingDaysEl.textContent = 'Calculated Working Days: — (Weekends excluded)';
    }
  }

  if (fromDateInput) fromDateInput.addEventListener('change', updateCalculatedDays);
  if (toDateInput) toDateInput.addEventListener('change', updateCalculatedDays);

  if (leaveForm) {
    leaveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (leaveFeedback) leaveFeedback.textContent = '';

      const leaveType = document.getElementById('leaveType')?.value;
      const fromDate = fromDateInput ? fromDateInput.value : '';
      const toDate = toDateInput ? toDateInput.value : '';
      const reason = document.getElementById('leaveReason')?.value || '';

      const result = submitLeaveRequest(currentUser.id, {
        leaveType,
        fromDate,
        toDate,
        reason
      });

      if (result.success) {
        if (leaveFeedback) {
          leaveFeedback.textContent = result.message;
          leaveFeedback.style.color = 'var(--color-success)';
        }
        leaveForm.reset();
        updateCalculatedDays();
        renderMyLeavesTable(currentUser.id);
      } else {
        if (leaveFeedback) {
          leaveFeedback.textContent = result.message;
          leaveFeedback.style.color = 'var(--color-error)';
        }
      }
    });
  }

  // Render employee's submitted leaves
  renderMyLeavesTable(currentUser.id);

  // Initialize announcements
  initAnnouncements(currentUser);

  // Initialize employee Smart Helper
  initSmartHelper(currentUser);
}
