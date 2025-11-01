# Design Guidelines: Gestão Adapta Fiscal

## Design Approach

**Selected Approach**: Design System + Reference-Based Hybrid
- Primary Reference: Asaas (fintech/fiscal platform aesthetic)
- Secondary References: Modern SaaS dashboards (Linear, Notion) for data-heavy interfaces
- Design System Foundation: Tailwind CSS utility-first approach with custom component patterns

**Rationale**: Enterprise fiscal management requires trustworthiness, clarity, and efficiency. The Asaas-inspired aesthetic provides modern professionalism while maintaining the functional focus needed for tax document processing.

## Core Design Elements

### Typography

**Font Families**:
- Primary: Inter (via Google Fonts CDN) - for UI, forms, tables, body text
- Headings: Inter Bold/Semibold for hierarchy
- Data/Numbers: Inter with tabular-nums for consistent number alignment in tables

**Type Scale**:
- Hero/Page Headers: text-4xl to text-5xl (font-bold)
- Section Headers: text-2xl to text-3xl (font-semibold)
- Card Titles: text-lg to text-xl (font-semibold)
- Body Text: text-base (font-normal)
- Labels/Meta: text-sm (font-medium)
- Captions: text-xs

### Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4, p-6, p-8
- Section spacing: space-y-6, space-y-8
- Card gaps: gap-4, gap-6
- Page margins: mx-4 (mobile), mx-8 (desktop)

**Grid System**:
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Form layouts: grid-cols-1 md:grid-cols-2 gap-4
- Content areas: max-w-7xl mx-auto px-4

### Component Library

#### 1. Split-Screen Login (Asaas-Style)

**Layout**:
- Desktop: Two equal columns (lg:grid-cols-2)
- Mobile: Single column stack

**Left Panel - Authentication Form**:
- Centered form container (max-w-md mx-auto)
- Vertical spacing between elements: space-y-6
- Input fields: Full width with rounded-lg borders, p-3 height
- Password field: Eye icon toggle positioned absolute right-3
- Primary CTA button: Full width, rounded-lg, py-3
- "Esqueci senha" link: text-sm positioned below button
- Form background: Subtle gradient overlay

**Right Panel - Marketing/Promo**:
- Full-height flex layout with centered content
- Large heading: text-4xl font-bold with line-height tight
- Supporting text: text-lg with max-w-md
- Decorative elements: Floating XML/document icons or illustrations
- Stats showcase: Grid of 2-3 metric cards (small, rounded)
- CTA link: Underlined with arrow icon

#### 2. Dashboard Layout

**Structure**:
- Header: Fixed top bar (h-16) with logo left, company dropdown center-right, user menu right
- Sidebar: Fixed left navigation (w-64) with icon + label menu items
- Main content: ml-64 pt-16 with container max-w-7xl

**KPI Cards**:
- Grid layout: 4 cards across desktop, 2 on tablet, 1 on mobile
- Card structure: Rounded-xl, p-6, shadow-sm hover:shadow-md transition
- Content: Icon top-left (text-3xl), label text-sm, value text-2xl font-bold, trend indicator with percentage
- Chart integration: Small Chart.js canvas (h-24) for sparklines

**Recent Activity Table**:
- Container: Rounded-lg border with shadow-sm
- Header row: Sticky background with font-semibold text-sm
- Data rows: Hover state with alternating subtle backgrounds
- Cell padding: px-6 py-4
- Status badges: Inline-flex rounded-full px-3 py-1 text-xs

#### 3. Form Components

**Input Fields**:
- Container: space-y-2 wrapper
- Label: text-sm font-medium mb-1
- Input: w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-offset-2
- Helper text: text-xs mt-1
- Error state: Border change + error text in red

**CNPJ/Document Inputs**:
- Input mask formatting with consistent spacing
- Validation indicator icon (checkmark/error) positioned right

**Multi-Select Dropdowns**:
- Styled select with custom arrow icon
- Dropdown panel: Absolute positioning, rounded-lg shadow-lg, max-h-60 overflow-auto
- Option items: px-4 py-2 hover states with checkboxes

**Buttons**:
- Primary: Rounded-lg px-6 py-3 font-semibold
- Secondary: Outlined variant with border-2
- Icon buttons: Square aspect ratio, centered icon
- Disabled state: Opacity reduction with cursor-not-allowed

#### 4. File Upload Zone

**Drag-and-Drop Area**:
- Large dashed border (border-2 border-dashed), rounded-xl
- Min height: min-h-64
- Center-aligned content with upload cloud icon (text-6xl)
- Text hierarchy: "Arraste XMLs aqui" (text-xl), subtitle (text-sm)
- Hover state: Border solid with scale transform
- Active drop state: Background tint change

**File List Preview**:
- Each file: Flex row with file icon, name (truncate), size, remove button
- Progress bar: Full width rounded-full h-2 with animated fill

#### 5. Data Tables

**Table Container**:
- Wrapper: Overflow-x-auto rounded-lg border
- Table: w-full with border-collapse

**Header**:
- Background distinction with sticky positioning
- Sortable columns: Cursor pointer with sort icon
- Filter row: Integrated beneath headers with dropdown/date pickers inline

**Rows**:
- Hover: Subtle background transition
- Cell padding: px-6 py-4
- Text alignment: Left for text, right for numbers
- Action column: Flex gap-2 with icon buttons

**Pagination**:
- Bottom bar: Flex justify-between items-center px-6 py-4
- Page numbers: Inline-flex gap-1 with rounded buttons
- Items per page: Select dropdown on left

#### 6. XML Detail View

**Accordion Sections**:
- Section header: Flex justify-between px-6 py-4 cursor-pointer
- Header icon: Chevron with rotate transform on expand
- Content panel: px-6 py-4 with smooth max-height transition
- Subsections within: grid-cols-2 for paired data (label: value)

**Action Bar**:
- Sticky bottom or top bar with shadow
- Button group: Flex gap-3 with primary actions highlighted

**XML Preview**:
- Code block: Font mono, text-sm, p-4, overflow-auto max-h-96
- Syntax highlighting: Basic color coding for tags
- Copy button: Positioned top-right corner

#### 7. Modals/Overlays

**Modal Container**:
- Fixed inset-0 with backdrop blur
- Modal box: max-w-2xl mx-auto my-8 rounded-xl shadow-2xl
- Header: Border-b px-6 py-4 with close button
- Body: px-6 py-4 max-h-[60vh] overflow-y-auto
- Footer: Border-t px-6 py-4 with button group right-aligned

## Animations

Use sparingly for micro-interactions only:
- Button hover: Subtle scale (scale-105) or shadow change
- Card hover: Shadow elevation increase (transition-shadow)
- Modal entrance: Fade + slight scale (animate-in)
- Page transitions: None (instant for data-heavy app)
- Loading states: Spinner or skeleton screens (pulse animation)

## Images

**Hero/Marketing Section (Right Panel Login)**:
- Placement: Right 50% of split-screen login
- Type: Abstract illustration showing XML documents flowing into organized dashboard
- Style: Modern vector art with geometric shapes, semi-transparent elements
- Fallback: Gradient background with icon pattern if illustration unavailable

**Dashboard**:
- No large hero images
- Small icons for KPI cards (64x64 SVG via Heroicons)
- Chart visualizations via Chart.js (programmatic, not images)

**Empty States**:
- Placeholder illustrations for empty tables/lists
- Style: Simple line art, centered, with call-to-action below

## Responsive Behavior

**Breakpoints**:
- Mobile: base (< 768px) - single column, stacked navigation
- Tablet: md (768px+) - 2-column grids, sidebar visible
- Desktop: lg (1024px+) - Full multi-column layouts, persistent sidebar

**Mobile Adaptations**:
- Sidebar becomes hamburger menu drawer
- Dashboard cards stack vertically
- Tables: Horizontal scroll or card-based transformation
- Split-screen login: Stack vertically (promo section at top)

## Professional Fiscal Theme Notes

- Prioritize clarity and scannability for data-heavy tables
- Use subtle borders and shadows over heavy visual treatments
- Maintain high contrast for text readability (especially numbers)
- Group related data visually with card containers
- Status indicators should be immediately recognizable (badges with icons)
- Consistent iconography throughout (use Heroicons exclusively)
- Form validation must be instant and clear
- Loading states for all async operations (especially XML processing)