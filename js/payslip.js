/**
 * HCM LITE — Monthly Payslip Module
 * Implements strict hackathon payroll formulas, monthly attendance deductions,
 * print triggering, and role-based staff selection.
 *
 * Payroll Formulas:
 * 1. Daily salary = Monthly salary ÷ Working days in the month
 * 2. Deductions = Daily salary × (Absent days + 0.5 × Half-day count)
 * 3. Net salary = Monthly salary − Deductions
 */

let activePayslipEmployeeId = null;

/**
 * Calculate Monthly Payslip Calculations for an Employee
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month - 1 to 12
 * @returns {Object|null}
 */
function calculatePayslipData(employeeId, year, month) {
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const employee = users.find(u => u.id === employeeId);
  if (!employee) return null;

  const company = getCompanyConfig();
  const workingDaysList = company.workingDays || [1, 2, 3, 4, 5];

  // Working days in this calendar month based on configured schedule
  const totalWorkingDays = getWorkingDaysInMonth(year, month, workingDaysList);

  // Retrieve calculated attendance metrics for this period
  const attendanceStats = getEmployeeMonthlyAttendanceStats(employeeId, year, month);

  const monthlySalary = parseFloat(employee.monthlySalary) || 0;

  // Formula 1: Daily salary = Monthly salary ÷ Working days in the month
  let dailySalary = 0;
  if (totalWorkingDays > 0) {
    dailySalary = monthlySalary / totalWorkingDays;
  }

  // Formula 2: Absence Deduction = Daily salary × Absent days
  const absentDeduction = dailySalary * attendanceStats.absentDays;

  // Half-day Deduction = Daily salary × 0.5 × Half-day count
  const halfDayDeduction = dailySalary * 0.5 * attendanceStats.halfDays;

  // Total deductions = Daily salary × (Absent days + 0.5 × Half-day count)
  const totalDeductions = absentDeduction + halfDayDeduction;

  // Formula 3: Net salary = Monthly salary − Deductions
  const netSalary = Math.max(0, monthlySalary - totalDeductions);

  return {
    employee,
    company,
    year,
    month,
    monthlySalary,
    totalWorkingDays,
    presentDays: attendanceStats.presentDays,
    absentDays: attendanceStats.absentDays,
    halfDays: attendanceStats.halfDays,
    dailySalary,
    absentDeduction,
    halfDayDeduction,
    totalDeductions,
    netSalary
  };
}

/**
 * Render the Official Printable Payslip Document
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month
 */
function renderPayslipDocument(employeeId, year, month) {
  const data = calculatePayslipData(employeeId, year, month);
  if (!data) return;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1];

  // Company Header
  const companyNameEl = document.getElementById('payslipCompanyName');
  const companyAddressEl = document.getElementById('payslipCompanyAddress');
  const companyContactEl = document.getElementById('payslipCompanyContact');
  if (companyNameEl) companyNameEl.textContent = data.company.name || 'Acme Corporation';
  if (companyAddressEl) companyAddressEl.textContent = data.company.address || '';
  if (companyContactEl) companyContactEl.textContent = `${data.company.email || ''} · ${data.company.phone || ''}`;

  // Period & Prepared Date
  const periodTitle = document.getElementById('payslipPeriodTitle');
  const preparedDate = document.getElementById('payslipPreparedDate');
  if (periodTitle) periodTitle.textContent = `Pay Period: ${monthName} ${year}`;
  if (preparedDate) {
    // Last day of specified month or today
    const lastDay = new Date(year, month, 0).getDate();
    preparedDate.textContent = `${monthName} ${lastDay}, ${year}`;
  }

  // Employee Metadata
  const empName = document.getElementById('payslipEmpName');
  const empId = document.getElementById('payslipEmpId');
  const empDept = document.getElementById('payslipDept');
  const empDesignation = document.getElementById('payslipDesignation');

  if (empName) empName.textContent = data.employee.fullName;
  if (empId) empId.textContent = data.employee.id;
  if (empDept) empDept.textContent = data.employee.department || '—';
  if (empDesignation) empDesignation.textContent = data.employee.jobTitle || 'Staff Member';

  // Attendance summary bar
  const workingDaysEl = document.getElementById('payslipWorkingDays');
  const presentDaysEl = document.getElementById('payslipPresentDays');
  const absentDaysEl = document.getElementById('payslipAbsentDays');
  const halfDaysEl = document.getElementById('payslipHalfDays');
  const dailyRateEl = document.getElementById('payslipDailyRate');

  if (workingDaysEl) workingDaysEl.textContent = data.totalWorkingDays;
  if (presentDaysEl) presentDaysEl.textContent = data.presentDays;
  if (absentDaysEl) absentDaysEl.textContent = data.absentDays;
  if (halfDaysEl) halfDaysEl.textContent = data.halfDays;
  if (dailyRateEl) dailyRateEl.textContent = formatCurrency(data.dailySalary);

  // Financial Breakdown
  const basicSalaryEl = document.getElementById('payslipBasicSalary');
  const grossEarningsEl = document.getElementById('payslipGrossEarnings');
  const absenceDeductionEl = document.getElementById('payslipAbsenceDeduction');
  const halfDayDeductionEl = document.getElementById('payslipHalfDayDeduction');
  const totalDeductionsEl = document.getElementById('payslipTotalDeductions');
  const netSalaryEl = document.getElementById('payslipNetSalary');
  const inWordsEl = document.getElementById('payslipAmountInWords');

  if (basicSalaryEl) basicSalaryEl.textContent = formatCurrency(data.monthlySalary);
  if (grossEarningsEl) grossEarningsEl.textContent = formatCurrency(data.monthlySalary);
  if (absenceDeductionEl) absenceDeductionEl.textContent = formatCurrency(data.absentDeduction);
  if (halfDayDeductionEl) halfDayDeductionEl.textContent = formatCurrency(data.halfDayDeduction);
  if (totalDeductionsEl) totalDeductionsEl.textContent = formatCurrency(data.totalDeductions);
  if (netSalaryEl) netSalaryEl.textContent = formatCurrency(data.netSalary);

  if (inWordsEl) {
    inWordsEl.textContent = `Amount in words: ${numberToWords(data.netSalary)}`;
  }
}

/**
 * Initialize Payslip Page Controls & Role-based selector
 * @param {Object} currentUser
 */
function initPayslipPage(currentUser) {
  const urlParams = new URLSearchParams(window.location.search);
  const paramEmpId = urlParams.get('empId');

  const employees = getAllEmployees();
  if (employees.length === 0) {
    const doc = document.getElementById('payslipDocument');
    if (doc) {
      doc.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          <h4 class="empty-state-title">No employees found</h4>
          <p class="empty-state-desc">There are currently no registered employee accounts to generate payslips for.</p>
        </div>
      `;
    }
    return;
  }

  // Determine active employee for viewing
  if (currentUser.role === 'admin') {
    // Adapt sidebar, breadcrumbs and return button for admin
    const brandBadge = document.querySelector('.brand-badge');
    const brandSubtitle = document.querySelector('.brand-subtitle');
    const breadcrumbCurrent = document.querySelector('.topbar-breadcrumbs .current');
    const breadcrumbParent = document.querySelector('.topbar-breadcrumbs a');
    const returnBtn = document.querySelector('.topbar-right a.btn');

    if (brandBadge) {
      brandBadge.textContent = 'Admin';
      brandBadge.style.cssText = '';
    }
    if (brandSubtitle) brandSubtitle.textContent = 'Human Capital Management';
    if (breadcrumbParent) {
      breadcrumbParent.textContent = 'Admin';
      breadcrumbParent.href = 'admin.html';
    }
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Employee Payslips';
    if (returnBtn) {
      returnBtn.textContent = '← Return to Admin Dashboard';
      returnBtn.href = 'admin.html';
    }

    // Admin sidebar links
    const sidebarContainer = document.querySelector('.sidebar-nav-container');
    if (sidebarContainer) {
      sidebarContainer.innerHTML = `
        <div>
          <div class="nav-section-title">Core Management</div>
          <ul class="sidebar-nav">
            <li class="nav-item">
              <a href="admin.html" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                <span>Dashboard</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="employees.html" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Employees</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="admin.html#today-attendance" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Attendance</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="leaves.html" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>
                <span>Leave Management</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="payslip.html" class="nav-link active" aria-current="page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="7" cy="15" r="1"/></svg>
                <span>Payslips</span>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div class="nav-section-title">Organization & Tools</div>
          <ul class="sidebar-nav">
            <li class="nav-item">
              <a href="settings.html" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span>Company Settings</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="admin.html#announcements" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span>Announcements</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="admin.html#smart-helper" class="nav-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Smart Helper</span>
              </a>
            </li>
          </ul>
        </div>
      `;
    }

    // Admin can choose which employee to inspect
    activePayslipEmployeeId = (paramEmpId && employees.some(e => e.id === paramEmpId))
      ? paramEmpId
      : employees[0].id;

    // Inject Employee dropdown into toolbar if not already present
    injectAdminEmployeeSelector(employees, activePayslipEmployeeId);
  } else {
    // Regular employee can only view their own payslip
    activePayslipEmployeeId = currentUser.id;
  }

  const monthSelect = document.getElementById('payslipMonth');
  const yearSelect = document.getElementById('payslipYear');
  const printBtn = document.getElementById('printPayslipBtn');

  // Set default month & year to current date
  const now = new Date();
  if (monthSelect) monthSelect.value = String(now.getMonth() + 1);
  if (yearSelect) yearSelect.value = String(now.getFullYear());

  // Function to re-render with active selections
  function update() {
    const selectedMonth = parseInt(monthSelect ? monthSelect.value : (now.getMonth() + 1), 10);
    const selectedYear = parseInt(yearSelect ? yearSelect.value : now.getFullYear(), 10);
    renderPayslipDocument(activePayslipEmployeeId, selectedYear, selectedMonth);
  }

  if (monthSelect) monthSelect.addEventListener('change', update);
  if (yearSelect) yearSelect.addEventListener('change', update);

  // Native Print / Save PDF
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Initial render
  update();
}

/**
 * Inject Employee Selector into Toolbar for Admin Users
 * @param {Array} employees
 * @param {string} selectedId
 */
function injectAdminEmployeeSelector(employees, selectedId) {
  const toolbarControls = document.querySelector('.payslip-toolbar-controls');
  if (!toolbarControls || document.getElementById('payslipEmployeeSelect')) return;

  const select = document.createElement('select');
  select.id = 'payslipEmployeeSelect';
  select.className = 'form-select';
  select.style.minWidth = '200px';
  select.setAttribute('aria-label', 'Select Employee for Payslip');

  employees.forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.fullName} (${emp.id})`;
    if (emp.id === selectedId) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    activePayslipEmployeeId = select.value;
    const monthSelect = document.getElementById('payslipMonth');
    const yearSelect = document.getElementById('payslipYear');
    const now = new Date();
    const selectedMonth = parseInt(monthSelect ? monthSelect.value : (now.getMonth() + 1), 10);
    const selectedYear = parseInt(yearSelect ? yearSelect.value : now.getFullYear(), 10);
    renderPayslipDocument(activePayslipEmployeeId, selectedYear, selectedMonth);
  });

  // Insert before month select
  toolbarControls.insertBefore(select, toolbarControls.firstChild);
}
