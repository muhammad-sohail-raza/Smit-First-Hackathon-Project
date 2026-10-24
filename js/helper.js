/**
 * HCM LITE — Smart Helper Module
 * Rule-based natural language Q&A engine powered by actual LocalStorage records.
 * Enforces role-based data privacy and keyword normalization.
 */

/**
 * Process an inquiry from the Administrator Smart Helper
 * @param {string} rawQuery
 * @returns {string}
 */
function processAdminQuery(rawQuery) {
  const query = (rawQuery || '').toLowerCase().trim();
  const employees = getAllEmployees();
  const todayStr = getLocalDateString();
  const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  const todayRecords = attendance.filter(r => r.date === todayStr);

  // 1. "How many employees do we have?" / headcount
  if (query.includes('how many employee') || query.includes('headcount') || query.includes('total employee') || query.includes('how many staff')) {
    if (employees.length === 0) {
      return 'We currently have 0 registered employees in the organization directory.';
    }
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return `We currently have ${employees.length} registered employee${employees.length === 1 ? '' : 's'} across ${depts.size} department${depts.size === 1 ? '' : 's'}.`;
  }

  // 2. "Who is on leave today?" / "on leave"
  if (query.includes('who is on leave') || query.includes('on leave today') || query.includes('leave today')) {
    const onLeaveRecords = leaves.filter(l => l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate);
    if (onLeaveRecords.length === 0) {
      return 'No employees are on approved leave today.';
    }
    const names = onLeaveRecords.map(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      return emp ? `${emp.fullName} (${l.leaveType} Leave)` : `Staff ID ${l.employeeId}`;
    });
    return `There ${names.length === 1 ? 'is' : 'are'} ${names.length} employee${names.length === 1 ? '' : 's'} on leave today: ${names.join(', ')}.`;
  }

  // 3. "Who was late today?" / "late today" / "late arrivals"
  if (query.includes('late today') || query.includes('who was late') || query.includes('late arrival')) {
    const lateRecords = todayRecords.filter(r => r.isLate);
    if (lateRecords.length === 0) {
      return 'Great news! No employees have logged late arrivals today.';
    }
    const names = lateRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return emp ? `${emp.fullName} (checked in at ${formatDisplayTime(r.checkIn)})` : `Staff ID ${r.employeeId}`;
    });
    return `The following ${names.length} employee${names.length === 1 ? '' : 's'} checked in after the grace period cutoff today: ${names.join(', ')}.`;
  }

  // 4. "How many employees are present?" / "who is present"
  if (query.includes('how many') && query.includes('present') || query.includes('present today') || query.includes('attendance today')) {
    const presentCount = todayRecords.length;
    return `Today, ${presentCount} of ${employees.length} employee${employees.length === 1 ? '' : 's'} have checked in so far (${todayRecords.filter(r => !r.isLate).length} on time, ${todayRecords.filter(r => r.isLate).length} late).`;
  }

  // 5. "How many leave requests are pending?" / "pending leave" / "pending requests"
  if (query.includes('pending leave') || query.includes('leave request') || query.includes('pending request')) {
    const pendingList = leaves.filter(l => l.status === 'Pending');
    if (pendingList.length === 0) {
      return 'There are currently 0 pending leave applications awaiting review.';
    }
    return `There ${pendingList.length === 1 ? 'is' : 'are'} currently ${pendingList.length} pending leave request${pendingList.length === 1 ? '' : 's'} awaiting administrative approval in the Leave Queue.`;
  }

  // Fallback for unsupported admin questions
  return "I can answer questions regarding workforce headcount, today's attendance, late arrivals, and pending leave applications. Try clicking one of the suggested query chips above!";
}

/**
 * Process an inquiry from the Employee Smart Helper (Privacy-Protected)
 * @param {string} rawQuery
 * @param {string} employeeId
 * @returns {string}
 */
function processEmployeeQuery(rawQuery, employeeId) {
  const query = (rawQuery || '').toLowerCase().trim();
  const company = getCompanyConfig();
  const todayStr = getLocalDateString();
  const now = new Date();

  // 1. "How many leaves do I have left?" / "leave balance"
  if (query.includes('how many leave') || query.includes('leave balance') || query.includes('leaves left') || query.includes('remaining leave')) {
    const quota = company.yearlyLeaveQuota || 20;
    const approvedDays = getEmployeeApprovedLeaveDays(employeeId, now.getFullYear());
    const remaining = Math.max(0, quota - approvedDays);
    return `You have ${remaining} paid leave day${remaining === 1 ? '' : 's'} remaining for the year ${now.getFullYear()} (Annual quota: ${quota} days, Approved used: ${approvedDays} days).`;
  }

  // 2. "Was I late today?" / "am I late"
  if (query.includes('was i late') || query.includes('am i late') || query.includes('late today')) {
    const record = getEmployeeAttendanceForDate(employeeId, todayStr);
    if (!record) {
      return "You have not checked in yet today. Remember the grace period cutoff is 15 minutes past the office start time.";
    }
    if (record.isLate) {
      return `Yes, your check-in at ${formatDisplayTime(record.checkIn)} was logged as Late (exceeded start time + grace period).`;
    }
    return `No, you checked in on time at ${formatDisplayTime(record.checkIn)}!`;
  }

  // 3. "How many hours did I work this week?" / "hours this week" / "work hours"
  if (query.includes('hours') && (query.includes('week') || query.includes('work'))) {
    const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []).filter(r => r.employeeId === employeeId);
    // Find Monday of current week
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = getLocalDateString(monday);

    const thisWeekRecords = attendance.filter(r => r.date >= mondayStr && r.date <= todayStr);
    const totalMinutes = thisWeekRecords.reduce((sum, r) => sum + (r.workDuration || 0), 0);
    return `You have logged a total of ${formatDuration(totalMinutes)} across ${thisWeekRecords.length} workday${thisWeekRecords.length === 1 ? '' : 's'} this week (starting ${formatDisplayDate(mondayStr)}).`;
  }

  // 4. "What is my attendance status today?" / "today's status"
  if (query.includes('status today') || query.includes('attendance status') || query.includes('checked in')) {
    const record = getEmployeeAttendanceForDate(employeeId, todayStr);
    if (!record) {
      return "You are currently marked as Not Checked In for today.";
    }
    let details = `Your status today is "${record.status}". Check-in: ${formatDisplayTime(record.checkIn)}`;
    if (record.checkOut) {
      details += `, Check-out: ${formatDisplayTime(record.checkOut)} (Total: ${formatDuration(record.workDuration)}).`;
    } else {
      details += ` (Work shift currently active).`;
    }
    return details;
  }

  // Privacy-enforced fallback
  return "I'm your personal self-service assistant. I can answer questions about your remaining leaves, today's attendance status, and weekly logged hours. For privacy protection, other employees' records are not accessible.";
}

/**
 * Append message bubble to chat conversation container
 * @param {HTMLElement} container
 * @param {'user'|'agent'} sender
 * @param {string} text
 */
function appendChatMessage(container, sender, text) {
  if (!container) return;

  const bubble = document.createElement('div');
  if (sender === 'user') {
    bubble.className = 'chat-bubble-user';
    bubble.style.cssText = 'background: var(--color-primary); color: #fff; padding: 10px 14px; border-radius: 12px 12px 2px 12px; margin-bottom: 10px; max-width: 80%; margin-left: auto; font-size: var(--font-size-sm);';
    bubble.textContent = text;
  } else {
    bubble.className = 'chat-bubble-agent';
    bubble.style.cssText = 'background: var(--color-surface-subtle); border: 1px solid var(--color-border); padding: 10px 14px; border-radius: 12px 12px 12px 2px; margin-bottom: 10px; max-width: 85%; font-size: var(--font-size-sm); color: var(--color-text-main);';
    bubble.innerHTML = `<strong>Assistant:</strong> ${escapeHtml(text)}`;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

/**
 * Initialize Smart Helper Chat on current page
 * @param {Object} currentUser
 */
function initSmartHelper(currentUser) {
  const isAdmin = currentUser && currentUser.role === 'admin';

  // Container & Inputs for Admin or Employee
  const chatContainer = document.getElementById(isAdmin ? 'adminChatContainer' : 'empChatContainer') || document.querySelector('.chat-conversation');
  const chatInput = document.getElementById(isAdmin ? 'helperInput' : 'empHelperInput') || document.querySelector('.chat-input');
  const sendBtn = document.getElementById(isAdmin ? 'sendHelperBtn' : 'empSendHelperBtn') || document.querySelector('.chat-input-bar button');
  const form = document.getElementById(isAdmin ? 'helperForm' : 'empHelperForm') || document.querySelector('.chat-input-bar');

  if (!chatContainer || !chatInput) return;

  function handleSendQuery(text) {
    const query = (text || chatInput.value).trim();
    if (!query) return;

    // 1. Append user message
    appendChatMessage(chatContainer, 'user', query);
    chatInput.value = '';

    // 2. Compute response
    setTimeout(() => {
      const response = isAdmin
        ? processAdminQuery(query)
        : processEmployeeQuery(query, currentUser.id);
      appendChatMessage(chatContainer, 'agent', response);
    }, 250);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSendQuery();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendQuery();
    });
  }

  // Suggestion chips
  document.querySelectorAll('.helper-suggestion-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      handleSendQuery(chip.textContent.trim());
    });
  });
}
