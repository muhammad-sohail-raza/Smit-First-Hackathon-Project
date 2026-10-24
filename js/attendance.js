/**
 * HCM LITE — Attendance Management Module
 * Enforces punch-in/out business rules, grace period calculations,
 * half-day detection, absence tracking, and live dashboard rendering.
 */

/**
 * Record schema in hcm_attendance:
 * {
 *   id: string,
 *   employeeId: string,
 *   date: string (YYYY-MM-DD),
 *   checkIn: string (HH:mm),
 *   checkOut: string|null (HH:mm),
 *   workDuration: number (minutes),
 *   status: string ('Present' | 'Late' | 'Half Day'),
 *   isLate: boolean
 * }
 */

/**
 * Retrieve today's attendance record for an employee
 * @param {string} employeeId
 * @param {string} [dateStr]
 * @returns {Object|null}
 */
function getEmployeeAttendanceForDate(employeeId, dateStr = getLocalDateString()) {
  const records = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  return records.find(r => r.employeeId === employeeId && r.date === dateStr) || null;
}

/**
 * Process Employee Check-In for Today
 * @param {string} employeeId
 * @returns {{success: boolean, message: string, record?: Object}}
 */
function checkInEmployee(employeeId) {
  if (!employeeId) return { success: false, message: 'Invalid employee identification.' };

  const todayStr = getLocalDateString();
  const existing = getEmployeeAttendanceForDate(employeeId, todayStr);
  if (existing) {
    return { success: false, message: 'You have already checked in for today.' };
  }

  const company = getCompanyConfig();
  const currentTimeStr = getLocalTimeString(); // HH:mm

  // Calculate if arrival is late
  // Start Time + Grace Period
  const [sh, sm] = (company.officeStartTime || '09:00').split(':').map(Number);
  const graceMinutes = parseInt(company.gracePeriod || 15, 10);
  const cutoffTotalMinutes = (sh * 60 + sm) + graceMinutes;

  const [ch, cm] = currentTimeStr.split(':').map(Number);
  const checkInTotalMinutes = ch * 60 + cm;

  const isLate = checkInTotalMinutes > cutoffTotalMinutes;
  const initialStatus = isLate ? 'Late' : 'Present';

  const newRecord = {
    id: generateId('ATT'),
    employeeId: employeeId,
    date: todayStr,
    checkIn: currentTimeStr,
    checkOut: null,
    workDuration: 0,
    status: initialStatus,
    isLate: isLate
  };

  const attendanceList = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  attendanceList.push(newRecord);
  setStorage(STORAGE_KEYS.ATTENDANCE, attendanceList);

  return { success: true, message: isLate ? 'Checked in successfully (Logged as Late).' : 'Checked in on time. Have a productive day!', record: newRecord };
}

/**
 * Process Employee Check-Out for Today
 * @param {string} employeeId
 * @returns {{success: boolean, message: string, record?: Object}}
 */
function checkOutEmployee(employeeId) {
  if (!employeeId) return { success: false, message: 'Invalid employee identification.' };

  const todayStr = getLocalDateString();
  const attendanceList = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const index = attendanceList.findIndex(r => r.employeeId === employeeId && r.date === todayStr);

  if (index === -1) {
    return { success: false, message: 'You must check in before checking out.' };
  }

  const record = attendanceList[index];
  if (record.checkOut) {
    return { success: false, message: 'You have already checked out for today.' };
  }

  const currentTimeStr = getLocalTimeString();
  const durationMinutes = calculateMinutesBetween(record.checkIn, currentTimeStr);

  // Business rule: Less than 5 hours (300 minutes) completed work means Half Day
  let finalStatus = record.status;
  if (durationMinutes < 300) {
    finalStatus = 'Half Day';
  } else if (!record.isLate) {
    finalStatus = 'Present';
  } else {
    finalStatus = 'Late';
  }

  record.checkOut = currentTimeStr;
  record.workDuration = durationMinutes;
  record.status = finalStatus;

  attendanceList[index] = record;
  setStorage(STORAGE_KEYS.ATTENDANCE, attendanceList);

  return {
    success: true,
    message: `Checked out successfully at ${formatDisplayTime(currentTimeStr)}. Total duration: ${formatDuration(durationMinutes)}.`,
    record: record
  };
}

/**
 * Calculate Monthly Attendance Summary for an Employee
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month - 1 to 12
 * @returns {{presentDays: number, absentDays: number, lateDays: number, halfDays: number, totalWorkingDays: number}}
 */
function getEmployeeMonthlyAttendanceStats(employeeId, year, month) {
  const company = getCompanyConfig();
  const workingDaysList = company.workingDays || [1, 2, 3, 4, 5];
  const attendanceList = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const leavesList = getStorage(STORAGE_KEYS.LEAVES, []);
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const employee = users.find(u => u.id === employeeId);

  const totalWorkingDaysInMonth = getWorkingDaysInMonth(year, month, workingDaysList);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const isCurrentMonth = (year === currentYear && month === currentMonth);
  const isPastMonth = (year < currentYear || (year === currentYear && month < currentMonth));

  // Determine the last day to evaluate (exclude future calendar days)
  let maxDayToEvaluate;
  if (isCurrentMonth) {
    maxDayToEvaluate = currentDay;
  } else if (isPastMonth) {
    maxDayToEvaluate = new Date(year, month, 0).getDate();
  } else {
    maxDayToEvaluate = 0; // Future month
  }

  // Parse employee start date if present
  let empStartDay = 1;
  if (employee && employee.startDate) {
    const [sy, sm, sd] = employee.startDate.split('-').map(Number);
    if (sy === year && sm === month) {
      empStartDay = sd;
    } else if (sy > year || (sy === year && sm > month)) {
      // Started in a later month
      return { presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, totalWorkingDays: totalWorkingDaysInMonth };
    }
  }

  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;

  for (let day = empStartDay; day <= maxDayToEvaluate; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // Only inspect working days of week
    if (!workingDaysList.includes(dayOfWeek)) {
      continue;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Find attendance record for this day
    const attRecord = attendanceList.find(a => a.employeeId === employeeId && a.date === dateStr);

    if (attRecord) {
      if (attRecord.status === 'Half Day') {
        halfDays++;
      } else {
        presentDays++;
      }

      if (attRecord.isLate) {
        lateDays++;
      }
    } else {
      // Check if employee had approved leave covering this day
      const hasApprovedLeave = leavesList.some(l => {
        if (l.employeeId !== employeeId || l.status !== 'Approved') return false;
        return dateStr >= l.startDate && dateStr <= l.endDate;
      });

      if (!hasApprovedLeave) {
        // If it's today and the workday is still active, don't penalize as absent yet
        if (isCurrentMonth && day === currentDay) {
          // Incomplete today - skip absence increment
        } else {
          absentDays++;
        }
      }
    }
  }

  return {
    presentDays,
    absentDays,
    lateDays,
    halfDays,
    totalWorkingDays: totalWorkingDaysInMonth
  };
}

/**
 * Render Employee Attendance Dashboard Card & Table
 * @param {string} employeeId
 */
function renderEmployeeAttendanceDashboard(employeeId) {
  const todayStr = getLocalDateString();
  const record = getEmployeeAttendanceForDate(employeeId, todayStr);

  const displayCheckIn = document.getElementById('displayCheckIn');
  const displayCheckOut = document.getElementById('displayCheckOut');
  const displayWorkHours = document.getElementById('displayWorkHours');
  const todayStatusBadge = document.getElementById('todayStatus');
  const checkInBtn = document.getElementById('checkInButton');
  const checkOutBtn = document.getElementById('checkOutButton');

  if (displayCheckIn && displayCheckOut && displayWorkHours && todayStatusBadge) {
    if (record) {
      displayCheckIn.textContent = formatDisplayTime(record.checkIn);
      displayCheckOut.textContent = record.checkOut ? formatDisplayTime(record.checkOut) : '—:—';
      displayWorkHours.textContent = formatDuration(record.workDuration || 0);

      let badgeClass = 'badge-success';
      if (record.status === 'Late') badgeClass = 'badge-warning';
      if (record.status === 'Half Day') badgeClass = 'badge-warning';
      todayStatusBadge.className = `badge ${badgeClass}`;
      todayStatusBadge.innerHTML = `<span class="badge-dot-indicator"></span> ${record.status}`;

      if (checkInBtn) {
        checkInBtn.disabled = true;
        checkInBtn.classList.add('disabled');
      }
      if (checkOutBtn) {
        if (record.checkOut) {
          checkOutBtn.disabled = true;
          checkOutBtn.classList.add('disabled');
        } else {
          checkOutBtn.disabled = false;
          checkOutBtn.classList.remove('disabled');
        }
      }
    } else {
      displayCheckIn.textContent = '—:—';
      displayCheckOut.textContent = '—:—';
      displayWorkHours.textContent = '0h 00m';
      todayStatusBadge.className = 'badge badge-neutral';
      todayStatusBadge.innerHTML = '<span class="badge-dot-indicator"></span> Not Checked In';

      if (checkInBtn) {
        checkInBtn.disabled = false;
        checkInBtn.classList.remove('disabled');
      }
      if (checkOutBtn) {
        checkOutBtn.disabled = true;
        checkOutBtn.classList.add('disabled');
      }
    }
  }

  // Update Personal KPIs for current month
  const now = new Date();
  const stats = getEmployeeMonthlyAttendanceStats(employeeId, now.getFullYear(), now.getMonth() + 1);

  const presEl = document.getElementById('empPresentDays');
  const absEl = document.getElementById('empAbsentDays');
  const lateEl = document.getElementById('empLateDays');
  const remLeaveEl = document.getElementById('empRemainingLeaves');

  if (presEl) presEl.textContent = stats.presentDays;
  if (absEl) absEl.textContent = stats.absentDays;
  if (lateEl) lateEl.textContent = stats.lateDays;

  if (remLeaveEl) {
    const quota = getCompanyConfig().yearlyLeaveQuota || 20;
    const approvedDays = getEmployeeApprovedLeaveDays(employeeId, now.getFullYear());
    remLeaveEl.textContent = `${Math.max(0, quota - approvedDays)} Days`;
  }

  // Render My Attendance History Table
  renderMyAttendanceTable(employeeId);
}

/**
 * Render Employee's Historical Attendance Table
 * @param {string} employeeId
 */
function renderMyAttendanceTable(employeeId) {
  const tableBody = document.getElementById('myAttendanceTableBody');
  if (!tableBody) return;

  const records = getStorage(STORAGE_KEYS.ATTENDANCE, [])
    .filter(r => r.employeeId === employeeId)
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (records.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 0;">
          <div class="empty-state" id="myAttendanceEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h4 class="empty-state-title">No attendance history</h4>
            <p class="empty-state-desc">
              Daily time logs will appear here once you check in each morning.
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  records.forEach(r => {
    let badgeClass = 'badge-success';
    if (r.status === 'Late') badgeClass = 'badge-warning';
    if (r.status === 'Half Day') badgeClass = 'badge-warning';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 500;">${formatDisplayDate(r.date, true)}</td>
      <td>${formatDisplayTime(r.checkIn)}</td>
      <td>${r.checkOut ? formatDisplayTime(r.checkOut) : '—:—'}</td>
      <td style="font-weight: 600;">${formatDuration(r.workDuration || 0)}</td>
      <td><span class="badge ${badgeClass}">${r.status}</span></td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Render Today's Attendance Table for Administrator
 */
function renderAdminTodayAttendance() {
  const tableBody = document.getElementById('attendanceTableBody');
  if (!tableBody) return;

  const todayStr = getLocalDateString();
  const allRecords = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const todayRecords = allRecords.filter(r => r.date === todayStr);
  const users = getStorage(STORAGE_KEYS.USERS, []);

  // Update Admin KPIs
  updateAdminKPIs(todayRecords);

  if (todayRecords.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0;">
          <div class="empty-state" id="attendanceEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h4 class="empty-state-title">No attendance records today</h4>
            <p class="empty-state-desc">
              Attendance records will appear here automatically when employees check in through their personal dashboard.
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  todayRecords.forEach(r => {
    const employee = users.find(u => u.id === r.employeeId) || { fullName: 'Unknown', department: '—' };
    const initials = (employee.fullName || 'E')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    let badgeClass = 'badge-success';
    if (r.status === 'Late') badgeClass = 'badge-warning';
    if (r.status === 'Half Day') badgeClass = 'badge-warning';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="table-user-cell">
          <div class="user-avatar" style="background: var(--grad-primary);">${initials}</div>
          <div>
            <div class="user-name" style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(employee.fullName)}</div>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(employee.jobTitle || r.employeeId)}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(employee.department || '—')}</td>
      <td style="font-weight: 500;">${formatDisplayTime(r.checkIn)}</td>
      <td>${r.checkOut ? formatDisplayTime(r.checkOut) : '—:—'}</td>
      <td><span class="badge ${badgeClass}">${r.status}</span></td>
      <td style="text-align: right;">
        <a href="payslip.html?empId=${encodeURIComponent(r.employeeId)}" class="btn btn-sm btn-ghost">View Slip</a>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Update Admin KPI Summary Values on Dashboard
 * @param {Array} todayRecords
 */
function updateAdminKPIs(todayRecords) {
  const employees = getAllEmployees();
  const todayStr = getLocalDateString();
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);

  // 1. Total Employees
  const kpiTotal = document.getElementById('kpiTotalEmployees');
  if (kpiTotal) kpiTotal.textContent = employees.length;

  // 2. Present Today (Checked in on schedule or present)
  const kpiPresent = document.getElementById('kpiPresentToday');
  const presentCount = todayRecords.filter(r => !r.isLate).length;
  if (kpiPresent) kpiPresent.textContent = presentCount;

  // 3. On Leave Today
  const kpiOnLeave = document.getElementById('kpiOnLeave');
  const onLeaveCount = leaves.filter(l => l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate).length;
  if (kpiOnLeave) kpiOnLeave.textContent = onLeaveCount;

  // 4. Late Arrivals Today
  const kpiLate = document.getElementById('kpiLateArrivals');
  const lateCount = todayRecords.filter(r => r.isLate).length;
  if (kpiLate) kpiLate.textContent = lateCount;

  // Update visual attendance bar chart preview and department distribution
  renderAttendanceOverviewVisual();
  renderDepartmentDistributionVisual();
}

/**
 * Render Weekly Attendance CSS Chart Preview on Admin Dashboard
 */
function renderAttendanceOverviewVisual() {
  const chartContainer = document.querySelector('.bar-chart-preview');
  if (!chartContainer) return;

  const attendanceList = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const employees = getAllEmployees();
  const totalStaff = employees.length || 1;

  // Calculate Monday through Friday of current week
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Calculate Monday
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const dayBars = chartContainer.querySelectorAll('.chart-bar-group');
  if (dayBars.length < 5) return;

  let totalRecordsThisWeek = 0;

  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(dayDate);

    const dayRecords = attendanceList.filter(a => a.date === dateStr);
    totalRecordsThisWeek += dayRecords.length;

    const presentPillar = dayBars[i].querySelector('.bar-pillar.present');
    const latePillar = dayBars[i].querySelector('.bar-pillar.late');
    const absentPillar = dayBars[i].querySelector('.bar-pillar.absent');

    const presentCount = dayRecords.filter(r => !r.isLate && r.status !== 'Half Day').length;
    const lateCount = dayRecords.filter(r => r.isLate).length;
    const absentCount = Math.max(0, totalStaff - dayRecords.length);

    if (presentPillar) {
      const heightPct = Math.min(100, Math.round((presentCount / totalStaff) * 90));
      presentPillar.style.height = `${Math.max(6, heightPct)}%`;
      presentPillar.title = `${presentCount} Present`;
    }
    if (latePillar) {
      const heightPct = Math.min(100, Math.round((lateCount / totalStaff) * 90));
      latePillar.style.height = `${Math.max(6, heightPct)}%`;
      latePillar.title = `${lateCount} Late`;
    }
    if (absentPillar) {
      const heightPct = Math.min(100, Math.round((absentCount / totalStaff) * 90));
      absentPillar.style.height = `${Math.max(6, heightPct)}%`;
      absentPillar.title = `${absentCount} Absent`;
    }
  }

  const emptyBanner = document.querySelector('.card .chart-empty-banner');
  if (emptyBanner) {
    if (totalRecordsThisWeek > 0) {
      emptyBanner.style.display = 'none';
    } else {
      emptyBanner.style.display = 'block';
    }
  }
}

/**
 * Render Department Distribution on Admin Dashboard
 */
function renderDepartmentDistributionVisual() {
  const stack = document.querySelector('.dept-bar-stack');
  const legendList = document.querySelector('.dept-legend-list');
  if (!stack || !legendList) return;

  const employees = getAllEmployees();
  if (employees.length === 0) return;

  const counts = {};
  employees.forEach(e => {
    const dept = e.department || 'Unassigned';
    counts[dept] = (counts[dept] || 0) + 1;
  });

  const colors = ['#2563EB', '#60A5FA', '#0D9488', '#D97706', '#7C3AED', '#EC4899'];
  const depts = Object.keys(counts);

  stack.innerHTML = '';
  legendList.innerHTML = '';

  depts.forEach((dept, index) => {
    const count = counts[dept];
    const pct = Math.round((count / employees.length) * 100);
    const color = colors[index % colors.length];

    // Segment
    const seg = document.createElement('div');
    seg.className = 'dept-segment';
    seg.style.width = `${pct}%`;
    seg.style.backgroundColor = color;
    seg.title = `${dept}: ${count} staff (${pct}%)`;
    stack.appendChild(seg);

    // Legend item
    const row = document.createElement('div');
    row.className = 'dept-legend-row';
    row.innerHTML = `
      <span class="dept-legend-name">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${color};"></span>
        ${escapeHtml(dept)}
      </span>
      <span class="dept-legend-count">${count} staff (${pct}%)</span>
    `;
    legendList.appendChild(row);
  });

  const banner = document.querySelector('.dept-distribution-box .chart-empty-banner');
  if (banner) banner.style.display = 'none';
}
