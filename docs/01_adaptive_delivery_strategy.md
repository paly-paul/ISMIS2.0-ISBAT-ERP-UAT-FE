Adaptive Delivery & Responsive Architecture Guidelines
1. Overview
As part of our transition to a modern Next.js architecture, we are implementing Adaptive Delivery alongside standard responsive design (Tailwind CSS). While CSS media queries are sufficient for resizing standard elements, relying strictly on client-side rendering for entirely different device layouts (e.g., a complex desktop data grid vs. a streamlined mobile card view) introduces performance bottlenecks and UI flickering during React hydration.

Adaptive Delivery solves this by resolving the device type at the edge (Middleware) before the page is rendered on the server.

2. The Strategy: Middleware-Level Detection
By intercepting the request in Next.js Middleware, we parse the User-Agent to determine the device category. We then inject a custom HTTP header (x-device-type) into the request. Server Components read this header to selectively render and stream only the HTML/JS required for that specific device profile.

Benefits for the ERP Modernization
Zero UI Flicker: Users will never see a desktop layout snap into a mobile layout on initial load.

Reduced Payload: Mobile devices will not download the JavaScript bundles for heavy desktop-only components (and vice versa).

Improved Core Web Vitals: Faster First Contentful Paint (FCP) and zero Cumulative Layout Shift (CLS) caused by media-query hydration delays.

3. Detection at the Middleware Level (Recommended)
Using Middleware. This allows you to detect the device on the server before the page even renders, preventing that "flicker" where a desktop site suddenly snaps into a mobile view.
•	How it works: Use the user-agent header to identify the device.
•	The Strategy: You can set a custom header (e.g., x-device-type) that your components or layouts read to decide which UI to mount.
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''
  const isMobile = /mobile|android|iphone/i.test(userAgent)
    const response = NextResponse.next()
  response.headers.set('x-device-type', isMobile ? 'mobile' : 'desktop')
  return response
}
4. Implementation: The Layout Strategy
To handle your specific UI requirements (Bottom Nav vs. Side Panels), you should use a Conditional Layout pattern.
A. The Bottom Navigation (Mobile Specific)
Instead of hiding/showing via CSS (display: none), which still loads the DOM elements, use a high-level toggle.
•	Desktop: Render a Sidebar or TopNav.
•	Mobile: Render a BottomStickyNav.
B. Filters and Pop-ups
This is where UX diverges the most.
•	Web: Filters are often a persistent sidebar.
•	Mobile: These should be triggered by a button that opens a Full-screen Drawer or a Bottom Sheet.
3. Technical Approaches for the UI Components
Feature	Desktop Web Design	Mobile Specific Design
Navigation	Top Bar / Left Sidebar	Bottom Tab Bar (Thumb-friendly)
Filters	Persistent Left Column	Overlay Drawer with "Apply" button
Modals	Centered Pop-up	Bottom Sheet (slides up from bottom)
Tables	Standard Grid	Card Stack or Horizontal Scroll

Use a Custom Hook for Client-Side logic
While Middleware is great for initial load, you’ll want a useDevice hook for logic inside your components:
const { isMobile } = useDevice();
return (
  <div>
    {isMobile ? <MobileFilters /> : <DesktopSidebar />}
    <MainContent />
    {isMobile && <BottomNav />}
  </div>
);
5. Performance Tip: Dynamic Imports
To ensure your mobile users aren't downloading heavy desktop-only libraries (and vice versa), use Next.js Dynamic Imports.
import dynamic from 'next/dynamic';
const DesktopHeavyChart = dynamic(() => import('./DesktopHeavyChart'), { 
  ssr: false 
});
const MobileLiteChart = dynamic(() => import('./MobileLiteChart'));
Note: Be careful with SEO and Caching. If you serve different HTML for the same URL based on the User-Agent, you must ensure your Vary: User-Agent header is set correctly so CDNs don't accidentally serve the mobile version to a desktop user. Next.js middleware handles much of this, but it's worth a double-check.

Adaptive Device Rendering Flow
graph TD
    A[User Requests Page] --> B{Next.js Middleware}
    
    %% Server-Side Detection
    B -->|Analyze User-Agent Header| C{Is Mobile?}
    
    %% Routing & Layout Selection
    C -->|Yes| D[Inject 'x-device: mobile' Header]
    C -->|No| E[Inject 'x-device: desktop' Header]
    
    D --> F[Root Layout: Mobile Shell]
    E --> G[Root Layout: Desktop Shell]
    
    %% Component Specific Logic
    F --> H[Render Bottom Navigation]
    F --> I[Load Mobile-Specific Components]
    I --> I1[Filters: Bottom Sheet Drawer]
    I --> I2[Pop-ups: Slide-up Modals]
    
    G --> J[Render Sidebar/Top Nav]
    G --> K[Load Desktop-Specific Components]
    K --> K1[Filters: Left Sticky Sidebar]
    K --> K2[Pop-ups: Centered Modals]
    
    %% Final Delivery
    H & I1 & I2 --> L[Hydrate & Interaction Ready]
    J & K1 & K2 --> L
Breakdown of the Key Decision Points
1.	The Middleware Gate (B & C): This happens at the "Edge" (before your page code even runs). By detecting the device here, you avoid the "Layout Flicker" where a user sees a desktop site for a split second before it snaps to mobile.
2.	The Header Injection (D & E): This passes the "truth" about the device down to your Server Components and Layouts.
3.	The Shell Switch (F & G): * Mobile Shell: Prioritizes the Bottom Navigation (within reach of the user's thumb).
o	Desktop Shell: Prioritizes the Sidebar/Top Nav (utilizing wide screen real estate).
4.	Feature Divergence (I & K): * On mobile, you replace high-density elements (like a massive filter sidebar) with a single button that triggers a Bottom Sheet.
o	This keeps the mobile screen clean while maintaining all the desktop's power.
Pro-Tip for Deployment
When you deploy this flow, ensure your Cache-Control includes Vary: User-Agent. This tells the CDN (like Vercel or Cloudflare) not to serve the desktop-cached version of a page to a mobile user.

Recommended Project Structure
src/
├── middleware.ts             # 1. Device detection logic
├── components/
│   ├── common/               # Shared components (Buttons, Inputs)
│   ├── desktop/              # Desktop-specific UI
│   │   ├── Sidebar.tsx
│   │   └── DesktopFilters.tsx
│   ├── mobile/               # Mobile-specific UI
│   │   ├── BottomNav.tsx
│   │   └── MobileDrawer.tsx
│   └── adaptive/             # Smart wrappers that switch between the two
│       └── FilterSystem.tsx  
├── hooks/
│   └── useDevice.ts          # Client-side hook for dynamic shifts
├── lib/
│   └── device.ts             # Helper to read headers/UA strings
└── app/
    ├── layout.tsx            # Main shell (detects device via headers)
    ├── (desktop)/            # Optional: Grouped desktop routes
    ├── (mobile)/             # Optional: Grouped mobile routes
    └── products/
        └── page.tsx          # Page using adaptive components
1. The Core Components
•	components/desktop/ & components/mobile/: Keep these strictly separate. The Mobile Bottom Nav and the Desktop Sidebar have completely different DOM structures and CSS. Trying to force one into the other via media queries often leads to bloated code.
•	components/adaptive/: These are your "orchestrator" components. For example, a FilterSystem.tsx component will import both DesktopFilters and MobileDrawer, rendering only the one required by the device type.
2. The Logic Layer (lib/ and hooks/)
•	lib/device.ts: A utility to extract the device type from Next.js headers. This is used in Server Components.
•	hooks/useDevice.ts: A hook using window.matchMedia or ResizeObserver. This is used in Client Components for real-time adjustments (like when a user resizes their browser window).
3. The Layout Strategy
In your app/layout.tsx, you decide which "Shell" to wrap the application in.
// app/layout.tsx
import { headers } from 'next/headers';
import DesktopNav from '@/components/desktop/Nav';
import BottomNav from '@/components/mobile/BottomNav';

export default function RootLayout({ children }) {
  const userAgent = headers().get('user-agent') || '';
  const isMobile = /mobile/i.test(userAgent);

  return (
    <html>
      <body>
        {!isMobile && <DesktopNav />}
        <main>{children}</main>
        {isMobile && <BottomNav />}
      </body>
    </html>
  );
}

Hybrid Usage (Tailwind + Adaptive)
Adaptive Delivery does not replace Tailwind CSS; it complements it.

Use Adaptive Delivery (Middleware) for structurally distinct components, heavy API data-fetching variations, or completely different user flows (e.g., Mobile Stepper Form vs. Desktop Single-Page Form).

Use Tailwind Breakpoints (md:, lg:) within those mounted components for micro-adjustments (padding, font sizes, flex wrapping) across similar screen sizes.
