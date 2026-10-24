# HCM Lite — Human Capital Management Web App UI

**HCM Lite** is a modern, production-quality Human Capital Management web application UI built for the Saylani Hackathon (Beginner Track).

This repository contains **Phase 1: Pure HTML5 & CSS3 Implementation**. It establishes the complete visual design system, layout structure, responsive behaviors, accessibility benchmarks, and prepared DOM hooks for future JavaScript, LocalStorage, and backend integrations.

---

## 📁 Project Structure

```text
├── index.html               # Page 1: Authentication & First-Run Setup (Split-Screen)
├── pages/
│   ├── admin.html           # Page 2: Master Administrator Dashboard
│   ├── employees.html       # Page 3: Employee Management & Staff Directory
│   ├── leaves.html          # Page 4: Leave Management & Administrative Approvals
│   ├── settings.html        # Page 5: Company Profile, Attendance Rules & Quotas
│   ├── employee.html        # Page 6: Employee Self-Service Dashboard & Punch-In
│   └── payslip.html         # Page 7: Official Monthly Payslip & Print Sheet
├── css/
│   └── style.css            # Master Design System, Components & Responsive Rules
└── README.md                # Project Documentation & Architecture Guide
```

---

## 🎨 Design System & Visual Identity (Premium Soft Purple Theme)

### Color System Tokens
- **Primary Purple:** `#7C3AED`
- **Dark Purple:** `#5B21B6`
- **Deep Purple:** `#4C1D95`
- **Soft Purple:** `#A78BFA`
- **Lavender:** `#C4B5FD`
- **Light Purple:** `#F3E8FF`
- **Very Light Purple:** `#FAF7FF`
- **White Surface:** `#FFFFFF`
- **Main Background:** `#FAF9FC`
- **Secondary Background:** `#F5F3F8`
- **Main Text:** `#1F1635`
- **Secondary Text:** `#6B647A`
- **Muted Text:** `#938BA3`
- **Border:** `#E9E2F2`
- **Dark Neutral:** `#292235`
- **Cool Gray:** `#E5E7EB`
- **Success Green:** `#15803D` / Background: `#F0FDF4` / Border: `#BBF7D0`
- **Warning Amber:** `#B45309` / Background: `#FFFBEB` / Border: `#FDE68A`
- **Error Red:** `#B91C1C` / Background: `#FEF2F2` / Border: `#FECACA`
- **Information Blue:** `#1D4ED8` / Background: `#EFF6FF` / Border: `#BFDBFE`
- **Muted Teal:** `#0F766E` / Background: `#F0FDFA`

### Gradients
- **Primary Purple Gradient:** `linear-gradient(135deg, #6D28D9 0%, #8B5CF6 55%, #A78BFA 100%)`
- **Deep Premium Gradient:** `linear-gradient(135deg, #4C1D95 0%, #6D28D9 55%, #8B5CF6 100%)`
- **Soft Lavender-to-White Gradient:** `linear-gradient(135deg, #F3E8FF 0%, #FFFFFF 100%)`
- **Subtle Purple Tint:** `linear-gradient(135deg, #FAF7FF 0%, #F3E8FF 100%)`

### Typography & Spacing
- **Font:** Inter with modern sans-serif fallback stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`)
- **Spacing Scale:** 8px grid scale (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`)
- **Border Radius:** `8px` (inputs/buttons), `10px` (form fields), `16px` (cards), `20px` (modals/hero banners)

---

## 🚀 Key Features by Page

### 1. `index.html` — Login & First-Run Setup
- **Split-Screen Layout:** Desktop hero illustration and marketing highlights on the left; clean authentication interface on the right.
- **Pure CSS Tab Switching:** Switch seamlessly between **Sign In** and **First-Run Company Setup** without JavaScript via URL anchors (`#first-run-setup` / `#sign-in-view`).
- **Quick Workspace Access:** Direct demo navigation buttons to jump directly into the **Admin Portal** or **Employee Portal**.
- **Form Integration Ready:** Includes `id="loginForm"` and `id="setupForm"` with required indicators and dedicated feedback containers.

### 2. `pages/admin.html` — Admin Dashboard
- **Welcome Hero:** Restrained blue gradient welcome card featuring real-time date display and primary quick actions.
- **KPI Summary Grid (4 Cards):** Total Employees, Present Today, On Leave, Late Arrivals.
- **Attendance & Department Visualizers:** CSS-based weekly attendance bar chart preview and department distribution progress breakdown.
- **Today's Attendance Table:** Real-time log table with empty-state handling.
- **Pending Leave Requests:** Review queue card linking to full leave management.
- **Smart Helper (AI Chat Interface):** Interactive HR assistant with quick query chips.
- **Announcements Section:** Broadcast notices card with clean empty state.

### 3. `pages/employees.html` — Employee Management
- **Directory Table:** Columns for Avatar/Name/Title, Employee ID, Department, Email, Salary, and Status.
- **Filter Bar:** Search input, Department dropdown filter, and Status filter.
- **Pure CSS Add/Edit Employee Modal:** Openable via anchor `#addEmployeeModal` and dismissible via `#`.
- **Form Fields:** Full Name, Email, Department, Designation, Monthly Salary, and Portal Password.
- **Zero Fabricated Records:** Clean empty states explaining how to add the first employee.

### 4. `pages/leaves.html` — Leave Management
- **Summary Metrics:** Pending, Approved, and Rejected counters.
- **Filters:** Status filter, Leave Type filter, and Date filter.
- **Leave Request Table:** Detailed breakdown including working days count.
- **Pure CSS Review Modal:** Dedicated `#reviewLeaveModal` dialog with applicant info, duration, employee reason, admin comment box, and Approve/Reject action buttons.
- **Policy Notice:** Explains automatic working-day calculations and weekend exclusion.

### 5. `pages/settings.html` — Company Settings
- **Company Profile:** Official company name, contact email, address, and phone number.
- **Attendance & Grace Period Rules:** Configurable Office Start Time (e.g. `09:00`), Grace Period in minutes (e.g. `15`), Daily Work Hours, and Working Days selector.
- **Late Arrival Policy:** Visual explanation of grace period rules.
- **Leave Quota & Policy:** Yearly allowance setting (e.g. `20` days) and policy description.
- **Actions:** Save Changes and Reset Defaults buttons with notification placeholder.

### 6. `pages/employee.html` — Employee Self-Service Dashboard
- **Personal Time Tracker Card:** Check In time, Check Out time, logged work hours, and primary **Check In** / **Check Out** punch buttons.
- **Personal Metrics:** Present Days, Absent Days, Late Arrivals, and Remaining Leave Balance.
- **Leave Application Form:** Leave type dropdown, From/To dates, calculated working days preview, reason textarea, and balance check.
- **Personal Attendance History Table:** Date, Check In, Check Out, Work Hours, and Status.
- **Employee Smart Helper:** Privacy-aware assistant restricted to the logged-in employee's personal attendance and leave data.

### 7. `pages/payslip.html` — Monthly Payslip & Print Sheet
- **Document Design:** Structured salary slip layout with company logo, employee details, attendance summary, earnings breakdown, and deductions breakdown.
- **Formula Specification Included:**
  - `Daily salary = Monthly salary ÷ Working days in the month`
  - `Deduction = Daily salary × (Absent days + 0.5 × Half days)`
  - `Net salary = Monthly salary − Deduction`
- **Dedicated Print Styles (`@media print`):** Strips away sidebar, topbar, buttons, and backgrounds; formats document cleanly for standard A4 printing and PDF export.

---

## 🛠 Technology Constraints Compliance

- **Pure HTML5 & CSS3:** No JavaScript, no `<script>` tags, no inline event handlers (`onclick`, etc.).
- **Zero External Frameworks:** No Bootstrap, Tailwind, jQuery, or React.
- **No NPM or Build Steps:** Directly runnable by opening `index.html` in any modern web browser.
- **Vector SVG Icons:** Lightweight inline SVGs for crisp, retina-ready icons without JavaScript icon libraries.
- **Clean State Handling:** No dummy or fake business data populated; clean empty states and neutral placeholders (`—`) used throughout.

---

## 📱 Responsive Breakpoints

1. **Large Desktop Monitors (> 1200px):** Full multi-column dashboard layout with persistent left navigation sidebar.
2. **Tablets & Medium Screens (768px – 1024px):** 2-column KPI grids, responsive table wrappers with horizontal scrolling, stacked banners.
3. **Mobile Phones (< 768px down to 320px):** Single-column KPI cards, full-width responsive form controls, slide-out drawer sidebar, stacked payslip details.

---

## 🎯 Phase 2 Integration Guide

All HTML elements are equipped with semantic IDs and classes ready for Phase 2 JavaScript logic:
- `id="loginForm"`, `id="setupForm"`, `id="employeeForm"`, `id="leaveForm"`, `id="settingsForm"`
- `id="attendanceTable"`, `id="leaveRequestsTable"`, `id="employeesTable"`
- `id="checkInButton"`, `id="checkOutButton"`
- `id="payslipDocument"` and respective calculation placeholders
- Reserved error and notification elements (`.form-feedback`) for form validation feedback.
