/**
 * HCM LITE — Storage Architecture & Utility Helpers
 * Centralized LocalStorage repository with cryptographic hashing,
 * date/time manipulation, working-day calculations, and formatting.
 */

// Primary LocalStorage Keys (Exact specification)
const STORAGE_KEYS = {
  COMPANY: 'hcm_company',
  USERS: 'hcm_users',
  ATTENDANCE: 'hcm_attendance',
  LEAVES: 'hcm_leaves',
  SESSION: 'hcm_session',
  ANNOUNCEMENTS: 'hcm_announcements'
};

// Default Company Settings Schema
const DEFAULT_COMPANY_CONFIG = {
  name: 'Acme Corporation',
  email: 'hr@company.com',
  address: '45 Innovation Way, Suite 300, Karachi',
  phone: '+92 21 34567890',
  officeStartTime: '09:00',
  gracePeriod: 15,
  dailyWorkHours: 8,
  workingDays: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri (Sunday=0, Saturday=6)
  yearlyLeaveQuota: 20,
  leavePolicyDescription: 'Employees are entitled to 20 paid leave days annually. All applications must be submitted at least 24 hours prior to planned absence, except in emergency sick leave situations.'
};

/**
 * Safely read and parse data from LocalStorage
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function getStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading key "${key}" from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Safely serialize and write data to LocalStorage
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error saving key "${key}" to localStorage:`, error);
    return false;
  }
}

/**
 * Remove an item from LocalStorage
 * @param {string} key
 */
function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing key "${key}" from localStorage:`, error);
  }
}

/**
 * Generate unique, readable IDs
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix = 'ID') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Cryptographic PBKDF2 Password Hashing with Web Crypto API
 * Generates unique salts and hashes passwords client-side.
 */

// Generate random cryptographic salt
function generateSalt(length = 16) {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Graceful fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Convert string to buffer
function stringToBuffer(str) {
  return new TextEncoder().encode(str);
}

// Convert buffer to hex string
function bufferToHex(buffer) {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password with PBKDF2 using SHA-256 and unique salt
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
async function hashPassword(password, salt) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        stringToBuffer(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: stringToBuffer(salt),
          iterations: 10000,
          hash: 'SHA-256'
        },
        passwordKey,
        256
      );

      return bufferToHex(derivedBits);
    } catch (e) {
      console.warn('Web Crypto PBKDF2 failed, using fallback hash:', e);
    }
  }

  // Graceful fallback for non-secure contexts (e.g. file:// without subtle crypto)
  let hash = 0;
  const combined = password + ':' + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

/**
 * Verify a plain password against stored salt and hash
 * @param {string} password
 * @param {string} salt
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, salt, storedHash) {
  if (!password || !salt || !storedHash) return false;
  const calculated = await hashPassword(password, salt);
  return calculated === storedHash;
}

/**
 * Date & Time Utility Functions (Local calendar-safe, no UTC shifts)
 */

/**
 * Returns local YYYY-MM-DD
 * @param {Date} [date]
 * @returns {string}
 */
function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns local 24-hr time HH:mm
 * @param {Date} [date]
 * @returns {string}
 */
function getLocalTimeString(date = new Date()) {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format 24-hr time HH:mm to 12-hr AM/PM
 * @param {string} timeStr
 * @returns {string}
 */
function formatDisplayTime(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return '—:—';
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return '—:—';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour is 12 AM
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Format YYYY-MM-DD to readable string (e.g. "Oct 24, 2026")
 * @param {string} dateStr
 * @param {boolean} [includeWeekday=false]
 * @returns {string}
 */
function formatDisplayDate(dateStr, includeWeekday = false) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);

  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };
  if (includeWeekday) {
    options.weekday = 'long';
  }
  return date.toLocaleDateString('en-US', options);
}

/**
 * Minutes to formatted duration (e.g. 485 mins -> "8h 05m")
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0 || isNaN(minutes)) return '0h 00m';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Calculate difference in minutes between two 24-hr HH:mm times on the same day
 * @param {string} startTimeStr
 * @param {string} endTimeStr
 * @returns {number}
 */
function calculateMinutesBetween(startTimeStr, endTimeStr) {
  if (!startTimeStr || !endTimeStr) return 0;
  const [sh, sm] = startTimeStr.split(':').map(Number);
  const [eh, em] = endTimeStr.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const diff = endMins - startMins;
  return diff > 0 ? diff : 0;
}

/**
 * Counts the number of working days between two dates inclusive
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @param {number[]} workingDaysList - e.g. [1, 2, 3, 4, 5]
 * @returns {number}
 */
function countWorkingDaysInRange(startDateStr, endDateStr, workingDaysList = [1, 2, 3, 4, 5]) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday ...
    if (workingDaysList.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Total working days in a calendar month
 * @param {number} year
 * @param {number} month - 1 to 12
 * @param {number[]} workingDaysList
 * @returns {number}
 */
function getWorkingDaysInMonth(year, month, workingDaysList = [1, 2, 3, 4, 5]) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (workingDaysList.includes(d.getDay())) {
      count++;
    }
  }
  return count;
}

/**
 * Currency Formatter
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return 'PKR 0.00';
  return 'PKR ' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Convert positive integer/decimal number to English words for official payslip
 * @param {number} num
 * @returns {string}
 */
function numberToWords(num) {
  if (isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const whole = Math.floor(num);
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n) {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  let words = '';
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const remainder = whole % 1000;

  if (crore > 0) words += convertChunk(crore) + ' Crore ';
  if (lakh > 0) words += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + ' Thousand ';
  if (remainder > 0) words += convertChunk(remainder);

  return words.trim() ? words.trim() + ' Rupees Only' : 'Zero Rupees Only';
}

/**
 * Get configured company settings, initialized with defaults if absent
 * @returns {Object}
 */
function getCompanyConfig() {
  const saved = getStorage(STORAGE_KEYS.COMPANY);
  if (!saved) {
    return { ...DEFAULT_COMPANY_CONFIG };
  }
  return { ...DEFAULT_COMPANY_CONFIG, ...saved };
}
