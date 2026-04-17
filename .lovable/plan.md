
## Butcher Shop Invoice & Revenue Tracker

A simple, fast app for you and your staff to log invoices, track daily revenue, record expenses, and see profit at a glance.

### Auth
- Email + password login (Lovable Cloud)
- Shared shop data — anyone logged in sees the same invoices, customers, and expenses
- Sign up / sign in / sign out flow with a protected app area

### Core data
- **Invoices**: customer name, date, amount, paid/unpaid status, optional notes
- **Expenses (daily costs)**: date, category (meat purchases, supplies, utilities, wages, other), amount, notes
- All data stored securely in Lovable Cloud with row-level security

### Pages
1. **Dashboard** (home)
   - Today's revenue, this week, this month
   - Outstanding (unpaid) total
   - Profit cards: today / this week / this month (revenue − expenses)
   - Revenue trend chart (last 30 days, line/bar)
   - Paid vs unpaid breakdown
   - Quick links to add invoice / add expense

2. **Invoices**
   - Searchable, filterable list (by date range, paid status, customer)
   - One-click toggle paid/unpaid
   - Add / edit / delete invoice in a dialog
   - Sort by date or amount

3. **Expenses**
   - List grouped by date with category totals
   - Add / edit / delete expense in a dialog
   - Filter by date range and category

4. **Reports**
   - Pick a date range
   - Revenue, expenses, profit, margin %
   - Breakdown by category (expenses) and paid status (invoices)
   - Daily breakdown chart

### UX & design
- Clean, light interface optimized for quick entry on desktop and mobile
- Large tap targets (you mentioned shop staff will use it)
- Currency formatting, date pickers, instant validation
- Toast confirmations for every save/delete
- Empty states with a clear "add your first invoice" CTA

### Out of scope (can add later)
- Itemized line items / per-invoice cost of goods
- Printable PDF invoices
- Customer history pages
- Multi-shop separation
