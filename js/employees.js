/**
 * HCM LITE — Employee Management Module
 * Comprehensive CRUD operations, directory filtering, search,
 * validation, secure credential creation, and data synchronization.
 */

// State for active edit mode
let currentEditingEmployeeId = null;

/**
 * Retrieve all employees (role === 'employee')
 * @returns {Array}
 */
function getAllEmployees() {
  const users = getStorage(STORAGE_KEYS.USERS, []);
  return users.filter(u => u.role === 'employee');
}

/**
 * Generate sequential human-readable Employee ID (e.g. EMP-1001)
 * @returns {string}
 */
function generateNextEmployeeId() {
  const employees = getAllEmployees();
  if (employees.length === 0) return 'EMP-1001';

  const numbers = employees.map(emp => {
    const match = emp.id && emp.id.match(/^EMP-(\d+)$/i);
    return match ? parseInt(match[1], 10) : 1000;
  });

  const max = Math.max(...numbers, 1000);
  return `EMP-${max + 1}`;
}

/**
 * Render the entire employee directory table with applied search & filters
 */
function renderEmployeesTable() {
  const tableBody = document.getElementById('employeesTableBody');
  if (!tableBody) return;

  const searchInput = document.getElementById('employeeSearchInput');
  const deptFilter = document.getElementById('deptFilter');
  const statusFilter = document.getElementById('statusFilter');
  const countBadge = document.getElementById('employeeCountBadge');

  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedDept = deptFilter ? deptFilter.value : '';
  const selectedStatus = statusFilter ? statusFilter.value : '';

  const employees = getAllEmployees();

  // Filter employees
  const filtered = employees.filter(emp => {
    const matchesSearch = !searchTerm ||
      (emp.fullName && emp.fullName.toLowerCase().includes(searchTerm)) ||
      (emp.id && emp.id.toLowerCase().includes(searchTerm)) ||
      (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
      (emp.jobTitle && emp.jobTitle.toLowerCase().includes(searchTerm));

    const matchesDept = !selectedDept || emp.department === selectedDept;
    const matchesStatus = !selectedStatus || emp.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Update badge count
  if (countBadge) {
    countBadge.textContent = `${filtered.length} Employee${filtered.length === 1 ? '' : 's'} Listed`;
  }

  // Update top summary metric cards
  updateEmployeeDirectoryMetrics();

  // Handle empty state
  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 0;">
          <div class="empty-state" id="employeesEmptyState">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="32" height="32">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h4 class="empty-state-title">${searchTerm || selectedDept || selectedStatus ? 'No matching employees found' : 'No employees onboarded yet'}</h4>
            <p class="empty-state-desc">
              ${searchTerm || selectedDept || selectedStatus ? 'Try adjusting your search criteria or clearing filters to view all staff records.' : 'Your organization directory is currently empty. Get started by adding your first employee.'}
            </p>
            ${!searchTerm && !selectedDept && !selectedStatus ? `
              <div class="empty-state-action">
                <button type="button" class="btn btn-primary" onclick="openAddEmployeeModal()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Your First Employee
                </button>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Populate rows cleanly
  tableBody.innerHTML = '';
  filtered.forEach(emp => {
    const tr = document.createElement('tr');

    // Initials for avatar
    const initials = (emp.fullName || 'E')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    // Status badge class
    let badgeClass = 'badge-neutral';
    if (emp.status === 'Active') badgeClass = 'badge-success';
    else if (emp.status === 'Inactive') badgeClass = 'badge-danger';
    else if (emp.status === 'On Leave') badgeClass = 'badge-warning';

    tr.innerHTML = `
      <td>
        <div class="table-user-cell">
          <div class="user-avatar" style="background: var(--grad-primary);">${initials}</div>
          <div>
            <div class="user-name" style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(emp.fullName)}</div>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(emp.jobTitle || 'Staff Member')}</span>
          </div>
        </div>
      </td>
      <td><span class="badge badge-neutral" style="font-family: monospace; font-size: 0.8rem;">${escapeHtml(emp.id)}</span></td>
      <td>${escapeHtml(emp.department || '—')}</td>
      <td><a href="mailto:${escapeHtml(emp.email)}" style="color: var(--color-primary);">${escapeHtml(emp.email)}</a></td>
      <td style="font-weight: 600;">${formatCurrency(emp.monthlySalary || 0)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(emp.status || 'Active')}</span></td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 6px; align-items: center;">
          <button type="button" class="btn btn-sm btn-ghost edit-emp-btn" data-id="${escapeHtml(emp.id)}" title="Edit Employee">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Edit
          </button>
          <a href="payslip.html?empId=${encodeURIComponent(emp.id)}" class="btn btn-sm btn-ghost" title="View Monthly Payslip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Slip
          </a>
          <button type="button" class="btn btn-sm btn-ghost delete-emp-btn" data-id="${escapeHtml(emp.id)}" data-name="${escapeHtml(emp.fullName)}" title="Delete Employee" style="color: var(--color-error);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Attach event handlers
  tableBody.querySelectorAll('.edit-emp-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditEmployeeModal(btn.dataset.id));
  });

  tableBody.querySelectorAll('.delete-emp-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteEmployeeWithConfirmation(btn.dataset.id, btn.dataset.name));
  });
}

/**
 * Update KPI cards at top of employee directory
 */
function updateEmployeeDirectoryMetrics() {
  const employees = getAllEmployees();
  const totalEmployeesEl = document.getElementById('metricTotalEmployees');
  const totalDeptsEl = document.getElementById('metricTotalDepartments');
  const activeEmployeesEl = document.getElementById('metricActiveEmployees');

  if (totalEmployeesEl) totalEmployeesEl.textContent = employees.length;

  if (totalDeptsEl) {
    const departments = new Set(employees.map(e => e.department).filter(Boolean));
    totalDeptsEl.textContent = departments.size;
  }

  if (activeEmployeesEl) {
    const activeCount = employees.filter(e => e.status === 'Active').length;
    activeEmployeesEl.textContent = activeCount;
  }
}

/**
 * Open Modal in Add Mode
 */
function openAddEmployeeModal() {
  currentEditingEmployeeId = null;
  const modal = document.getElementById('addEmployeeModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('employeeForm');
  const feedback = document.getElementById('empFormFeedback');
  const passwordGroup = document.getElementById('empPassword')?.closest('.form-grid-2');

  if (modalTitle) modalTitle.textContent = 'Add New Employee';
  if (feedback) feedback.textContent = '';
  if (form) form.reset();

  const passwordInput = document.getElementById('empPassword');
  const confirmPasswordInput = document.getElementById('empConfirmPassword');
  if (passwordInput) passwordInput.required = true;
  if (confirmPasswordInput) confirmPasswordInput.required = true;

  // Show modal via CSS target
  window.location.hash = 'addEmployeeModal';
}

/**
 * Open Modal in Edit Mode
 * @param {string} employeeId
 */
function openEditEmployeeModal(employeeId) {
  const employees = getAllEmployees();
  const emp = employees.find(e => e.id === employeeId);
  if (!emp) return;

  currentEditingEmployeeId = emp.id;
  const modalTitle = document.getElementById('modalTitle');
  const feedback = document.getElementById('empFormFeedback');

  if (modalTitle) modalTitle.textContent = `Edit Employee (${emp.id})`;
  if (feedback) feedback.textContent = '';

  // Populate fields
  document.getElementById('empFullName').value = emp.fullName || '';
  document.getElementById('empEmail').value = emp.email || '';
  document.getElementById('empDepartment').value = emp.department || '';
  document.getElementById('empJobTitle').value = emp.jobTitle || '';
  document.getElementById('empSalary').value = emp.monthlySalary || '';

  // Password fields are optional during edit
  const passwordInput = document.getElementById('empPassword');
  const confirmPasswordInput = document.getElementById('empConfirmPassword');
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.required = false;
    passwordInput.placeholder = 'Leave blank to keep current password';
  }
  if (confirmPasswordInput) {
    confirmPasswordInput.value = '';
    confirmPasswordInput.required = false;
    confirmPasswordInput.placeholder = 'Leave blank to keep current password';
  }

  window.location.hash = 'addEmployeeModal';
}

/**
 * Close Employee Modal
 */
function closeEmployeeModal() {
  window.location.hash = '';
  currentEditingEmployeeId = null;
}

/**
 * Save employee (Create or Update)
 * @param {Event} e
 */
async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  const feedback = document.getElementById('empFormFeedback');
  const saveBtn = document.getElementById('saveEmployeeBtn');

  if (feedback) {
    feedback.textContent = '';
    feedback.style.color = 'var(--color-error)';
  }

  const fullName = document.getElementById('empFullName').value.trim();
  const email = document.getElementById('empEmail').value.trim().toLowerCase();
  const department = document.getElementById('empDepartment').value;
  const jobTitle = document.getElementById('empJobTitle').value.trim();
  const salaryStr = document.getElementById('empSalary').value.trim();
  const password = document.getElementById('empPassword')?.value;
  const confirmPassword = document.getElementById('empConfirmPassword')?.value;

  // Validations
  if (!fullName) {
    showFormError(feedback, 'Full Name is required.');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showFormError(feedback, 'A valid company email address is required.');
    return;
  }
  if (!department) {
    showFormError(feedback, 'Please select a department.');
    return;
  }
  if (!jobTitle) {
    showFormError(feedback, 'Job title / designation is required.');
    return;
  }
  const salary = parseFloat(salaryStr);
  if (isNaN(salary) || salary <= 0) {
    showFormError(feedback, 'Monthly salary must be a positive number greater than 0.');
    return;
  }

  const users = getStorage(STORAGE_KEYS.USERS, []);

  // Check email uniqueness across all users
  const duplicateUser = users.find(u => u.email.toLowerCase() === email && u.id !== currentEditingEmployeeId);
  if (duplicateUser) {
    showFormError(feedback, 'An account with this email address already exists.');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    if (currentEditingEmployeeId) {
      // EDIT EXISTING EMPLOYEE
      const empIndex = users.findIndex(u => u.id === currentEditingEmployeeId);
      if (empIndex === -1) {
        showFormError(feedback, 'Employee record not found.');
        return;
      }

      users[empIndex].fullName = fullName;
      users[empIndex].email = email;
      users[empIndex].department = department;
      users[empIndex].jobTitle = jobTitle;
      users[empIndex].monthlySalary = salary;

      // Update password if entered
      if (password) {
        if (password.length < 6) {
          showFormError(feedback, 'New password must be at least 6 characters.');
          if (saveBtn) saveBtn.disabled = false;
          return;
        }
        if (password !== confirmPassword) {
          showFormError(feedback, 'Passwords do not match.');
          if (saveBtn) saveBtn.disabled = false;
          return;
        }
        const salt = generateSalt();
        users[empIndex].salt = salt;
        users[empIndex].passwordHash = await hashPassword(password, salt);
      }

      setStorage(STORAGE_KEYS.USERS, users);
      closeEmployeeModal();
      renderEmployeesTable();
    } else {
      // CREATE NEW EMPLOYEE
      if (!password || password.length < 6) {
        showFormError(feedback, 'Initial password must be at least 6 characters.');
        if (saveBtn) saveBtn.disabled = false;
        return;
      }
      if (password !== confirmPassword) {
        showFormError(feedback, 'Passwords do not match.');
        if (saveBtn) saveBtn.disabled = false;
        return;
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const newEmpId = generateNextEmployeeId();

      const newEmployee = {
        id: newEmpId,
        fullName: fullName,
        email: email,
        role: 'employee',
        department: department,
        jobTitle: jobTitle,
        monthlySalary: salary,
        status: 'Active',
        startDate: getLocalDateString(),
        salt: salt,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      };

      users.push(newEmployee);
      setStorage(STORAGE_KEYS.USERS, users);
      closeEmployeeModal();
      renderEmployeesTable();
    }
  } catch (err) {
    console.error('Error saving employee:', err);
    showFormError(feedback, 'An unexpected error occurred while saving the employee record.');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * Delete employee and clean up associated records
 * @param {string} employeeId
 * @param {string} employeeName
 */
function deleteEmployeeWithConfirmation(employeeId, employeeName) {
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const emp = users.find(u => u.id === employeeId);

  if (!emp) return;
  if (emp.role === 'admin') {
    alert('The Master Administrator account cannot be deleted.');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete employee "${employeeName}" (${employeeId})?\n\nThis will also remove their associated attendance logs and leave records.`
  );
  if (!confirmed) return;

  // 1. Remove employee from users
  const updatedUsers = users.filter(u => u.id !== employeeId);
  setStorage(STORAGE_KEYS.USERS, updatedUsers);

  // 2. Cascade delete attendance logs for this employee
  const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []);
  const updatedAttendance = attendance.filter(a => a.employeeId !== employeeId);
  setStorage(STORAGE_KEYS.ATTENDANCE, updatedAttendance);

  // 3. Cascade delete leave requests for this employee
  const leaves = getStorage(STORAGE_KEYS.LEAVES, []);
  const updatedLeaves = leaves.filter(l => l.employeeId !== employeeId);
  setStorage(STORAGE_KEYS.LEAVES, updatedLeaves);

  // Re-render
  renderEmployeesTable();
}

/**
 * Show inline error message
 * @param {HTMLElement} el
 * @param {string} msg
 */
function showFormError(el, msg) {
  if (el) {
    el.textContent = msg;
    el.style.color = 'var(--color-error)';
  } else {
    alert(msg);
  }
}

/**
 * Safe string escape for innerHTML insertion
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Initialize Employee Management Page
 */
function initEmployeePage() {
  renderEmployeesTable();

  // Search input live filtering
  const searchInput = document.getElementById('employeeSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderEmployeesTable());
  }

  // Dropdown filters
  const deptFilter = document.getElementById('deptFilter');
  if (deptFilter) {
    deptFilter.addEventListener('change', () => renderEmployeesTable());
  }

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => renderEmployeesTable());
  }

  // Open modal button
  const openBtn = document.getElementById('openAddEmployeeBtn');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAddEmployeeModal();
    });
  }

  // Cancel modal button
  const cancelBtn = document.getElementById('cancelEmployeeBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeEmployeeModal();
    });
  }

  // Form submit
  const form = document.getElementById('employeeForm');
  if (form) {
    form.addEventListener('submit', handleEmployeeFormSubmit);
  }
}
