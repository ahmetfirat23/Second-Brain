# Mergen — Project Guide for Claude

## Design Context

### Users
Solo personal use by one developer/builder. Checked on mobile (Samsung Galaxy S25 Android) throughout the day — quick captures, status checks, adding todos, chatting with the movie bot. Desktop for deeper work. The user is the only user; there's no audience to impress, only a tool to trust.

### Brand Personality
**Calm, sharp, personal.**
Mergen is a private cockpit — not a product, not a SaaS dashboard. The purple accent (`hsl(263 90% 65%)`) is the only personality it shows. Quiet when there's nothing to say, precise when there is.

### Aesthetic Direction
- **Reference**: Linear — information-dense, fast, elegant without trying. Lots of data per screen, nothing wasted.
- **Anti-reference**: Flashy / gamified — no badges, gratuitous gradients, celebration animations, or startup-demo energy.
- **Theme**: Dark-only. Background `hsl(0 0% 4%)`, cards `hsl(0 0% 9%)`.
- **Typography**: System UI stack. No decorative fonts.
- **Color**: Purple primary only. Status colors (red for destructive/overdue) used sparingly. No rainbow palettes.
- **Motion**: Minimal and functional only. Never decorative.
- **Mobile**: Compact vertical rhythm, ≥44px touch targets, no hover-only interactions.

### Design Principles

1. **Information density over empty space.** Tight `gap-2`/`gap-3` on mobile, relaxed on desktop. Every vertical pixel on mobile is precious.

2. **Actions are always reachable.** No hover-only controls. On mobile use ⋮ contextual menus. On desktop hover-reveal is fine.

3. **Calm consistency.** Purple primary, muted secondary, card surfaces. No new colors for novelty — use opacity or size for weight.

4. **Linear-style precision.** Tight borders and spacing. `rounded-lg` over `rounded-2xl`. Subtle borders over elevated shadows.

5. **No noise.** Remove anything non-functional. No decorative icons, no placeholder animations, no copy the user already knows.

## Tech Stack
- Next.js 16 (App Router) + Convex + Clerk
- Tailwind CSS v4 (no config file — tokens in `src/app/globals.css`)
- lucide-react, Radix UI primitives, dnd-kit, sonner, cmdk
- Design tokens: see `src/app/globals.css` and `.impeccable.md`
