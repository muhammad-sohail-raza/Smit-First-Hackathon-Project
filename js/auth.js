/**
 * HCM LITE — Authentication & Role-Based Authorization
 * Manages sessions, login verification, first-run admin onboarding,
 * route protection, and dynamic user identity updates.
 */

/**
 * Check if the application has an initial administrator account configured
 * @returns {boolean}
 */
function hasConfiguredAdmin() {
  const users = getStorage(STORAGE_KEYS.USERS, []);
  return users.some(u => u.role === 'admin');
}

/**
 * Get current session object
 * @returns {Object|null}
 */
function getCurrentSession() {
  return getStorage(STORAGE_KEYS.SESSION, null);
}

/**
 * Resolve current logged-in user record from database
 * @returns {Object|null}
 */
function getCurrentUser() {
  const session = getCurrentSession();
  if (!session || !session.userId) return null;
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const user = users.find(u => u.id === session.userId);
  if (!user || user.status === 'Inactive') return null;
  return user;
}

/**
 * Authenticate user with work email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message?: string, user?: Object}>}
 */
async function loginUser(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Please provide both work email and password.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = getStorage(STORAGE_KEYS.USERS, []);
  const user = users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return { success: false, message: 'Invalid email or password.' };
  }

  if (user.status === 'Inactive') {
    return { success: false, message: 'Your account has been deactivated. Please contact HR.' };
  }

  const isPasswordValid = await verifyPassword(password, user.salt, user.passwordHash);
  if (!isPasswordValid) {
    return { success: false, message: 'Invalid email or password.' };
  }

  // Set authenticated session with minimal identifier
  setStorage(STORAGE_KEYS.SESSION, {
    userId: user.id,
    role: user.role,
    loginAt: new Date().toISOString()
  });

  return { success: true, user };
}

/**
 * Register Master Administrator & Company on First-Run Setup
 * @param {Object} data
 * @returns {Promise<{success: boolean, message?: string, user?: Object}>}
 */
async function registerInitialAdmin(data) {
  const { companyName, adminName, adminEmail, adminPassword, confirmPassword } = data;

  if (!companyName || !companyName.trim()) {
    return { success: false, message: 'Organization name is required.' };
  }
  if (!adminName || !adminName.trim()) {
    return { success: false, message: 'Admin full name is required.' };
  }
  if (!adminEmail || !adminEmail.trim()) {
    return { success: false, message: 'Admin work email is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = adminEmail.trim().toLowerCase();
  if (!emailRegex.test(normalizedEmail)) {
    return { success: false, message: 'Please enter a valid work email address.' };
  }
  if (!adminPassword || adminPassword.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }
  if (adminPassword !== confirmPassword) {
    return { success: false, message: 'Passwords do not match.' };
  }

  // Prevent duplicate first-run setup
  if (hasConfiguredAdmin()) {
    return { success: false, message: 'An administrator account already exists. Please sign in.' };
  }

  // Generate cryptographic salt and hash
  const salt = generateSalt();
  const passwordHash = await hashPassword(adminPassword, salt);

  const adminUser = {
    id: generateId('ADM'),
    fullName: adminName.trim(),
    email: normalizedEmail,
    role: 'admin',
    department: 'Executive Management',
    jobTitle: 'System Administrator',
    monthlySalary: 0,
    status: 'Active',
    salt: salt,
    passwordHash: passwordHash,
    createdAt: new Date().toISOString()
  };

  // Save company details
  const companyConfig = getCompanyConfig();
  companyConfig.name = companyName.trim();
  companyConfig.email = normalizedEmail;
  setStorage(STORAGE_KEYS.COMPANY, companyConfig);

  // Save master user
  const users = getStorage(STORAGE_KEYS.USERS, []);
  users.push(adminUser);
  setStorage(STORAGE_KEYS.USERS, users);

  // Establish session
  setStorage(STORAGE_KEYS.SESSION, {
    userId: adminUser.id,
    role: adminUser.role,
    loginAt: new Date().toISOString()
  });

  return { success: true, user: adminUser };
}

/**
 * End current session and redirect to login
 */
function logoutUser() {
  removeStorage(STORAGE_KEYS.SESSION);
  const isInPagesDir = window.location.pathname.includes('/pages/');
  const target = isInPagesDir ? '../index.html' : 'index.html';
  window.location.href = target;
}

/**
 * Route protection guard for authenticated pages
 * @param {string[]} allowedRoles
 * @returns {Object|null}
 */
function requireAuth(allowedRoles = ['admin', 'employee']) {
  const isInPagesDir = window.location.pathname.includes('/pages/');
  const loginPath = isInPagesDir ? '../index.html' : 'index.html';

  const user = getCurrentUser();
  if (!user) {
    window.location.href = loginPath;
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    // If an employee attempts to access an admin-only page
    if (user.role === 'employee') {
      window.location.href = isInPagesDir ? 'employee.html' : 'pages/employee.html';
      return null;
    }
    // If an admin accesses an employee page, allow or redirect as appropriate
  }

  // Populate dynamic user identity across topbar and sidebar
  updateUserInterfaceIdentity(user);
  return user;
}

/**
 * Updates user avatar, names, and titles dynamically on page
 * @param {Object} user
 */
function updateUserInterfaceIdentity(user) {
  if (!user) return;

  // Extract initials (e.g. "Sarah Jenkins" -> "SJ")
  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || user.role[0].toUpperCase();

  // Update all avatar containers
  document.querySelectorAll('.user-avatar, .avatar').forEach(el => {
    el.textContent = initials;
  });

  // Update name labels
  document.querySelectorAll('.user-name, .profile-name').forEach(el => {
    el.textContent = user.fullName;
  });

  // Update roles/details
  document.querySelectorAll('.user-role-label, .profile-role').forEach(el => {
    if (el.classList.contains('user-role-label')) {
      el.textContent = user.email;
    } else {
      el.textContent = user.jobTitle || (user.role === 'admin' ? 'Administrator' : 'Employee');
    }
  });

  // Update greeting on dashboards if present
  const greetingEl = document.querySelector('.welcome-banner-content h2');
  if (greetingEl) {
    if (user.role === 'admin') {
      greetingEl.textContent = `Good morning, ${user.fullName.split(' ')[0] || 'Admin'}`;
    } else {
      greetingEl.textContent = `Welcome back, ${user.fullName.split(' ')[0]}!`;
    }
  }

  // Wire up logout buttons
  document.querySelectorAll('.logout-btn, a[title="Sign Out"]').forEach(btn => {
    btn.removeAttribute('href');
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  });
}
