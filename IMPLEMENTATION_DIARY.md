# Implementation Diary

Reference log of tasks completed and remaining. Update as work progresses.

---

## 2025-03-01 Session

### Completed

1. **Goal cards: click to expand details**
   - Whole content area (title, description, importance, size) is now clickable
   - Clicking toggles expand/collapse of description — no need to edit to see details
   - Goals without description: no expand (cursor only when description exists)

2. **Goal cards: overflow menu on mobile**
   - Desktop (lg+): Edit/Delete on hover (unchanged)
   - Mobile: Three-dot overflow menu (⋮) — tap opens Edit / Delete
   - 44px touch target for overflow button

3. **Part 1 – Poster text readability**
   - `aspect-[2/3]`, `object-contain` for poster
   - Gradient `from-black/50` for text overlay

4. **Part 2 – Goals chevron**
   - Chevron for goals with descriptions
   - Click chevron or title to expand/collapse
   - Goals with descriptions expand by default

5. **Part 4 – PWA**
   - `public/manifest.json`, icons 192x192, 512x512
   - Layout metadata: manifest link, appleWebApp

6. **Part 6 – Filtering**
   - Goals: size, importance, status
   - Daily Todos: urgency
   - Tracker: category, urgency (overdue / this week / later)
   - Watch List: category

7. **Part 7 – Go to watched**
   - Button moved to "To watch" header row
   - Smaller styling (`text-xs`)

8. **Part 5 – AI provider**
   - Grok / GPT, GPT-5-mini / GPT-5-nano
   - `apiUsage` by provider, by week
   - Movie chat settings: provider + model selector

9. **Part 3 – Mobile (partial)**
   - Bottom nav (Brain, Todos, Watch, Goals, KB, More)
   - More: Tracker, Vault, API Usage
   - Compact mobile header with logo + search
   - Sidebar hidden on mobile, shown on lg+
   - `pb-16` for bottom nav clearance

10. **GPT-5 pricing**
    - gpt-5-mini: $0.25/1M in, $2.00/1M out
    - gpt-5-nano: $0.05/1M in, $0.40/1M out

---

### Browser audit notes (mobile + desktop)

| Page        | Mobile | Desktop | Notes |
|------------|--------|---------|-------|
| Brain Dump | OK     | OK      | Clean, skimmable. Title + textarea + Save/Tidy. |
| Goals      | OK     | OK      | Filters, overflow menu, click-to-expand. Cards readable. |
| Watch List | OK     | OK      | Category filter, Go to watched in header. Grid of posters. 196 items — consider pagination if slow. |
| Daily Todos| —      | —       | Not fully audited. Has urgency filter. |
| Tracker    | —      | —       | Not fully audited. Has category + urgency filters. |
| API Usage  | —      | —       | By provider, weekly, daily tables. |
| Knowledge Base | —  | —       | Not audited. |
| Vault      | —      | —       | Not audited. |

**Potential issues to revisit:**
- Watch List: 196 items — check performance
- Goal drag handle on mobile: may conflict with scroll
- Desktop: confirm sidebar shows at lg (1024px+)

---

### 2025-03-01 Design pass

1. **Chat FAB overlap** — Moved above bottom nav on mobile (`bottom-[72px]`), desktop unchanged
2. **Mobile header compact** — h-12→h-9, smaller logo, text-xs
3. **Page headers** — Compact on mobile, smaller subtitles (text-[10px]), less margin
4. **Goal card redesign** — Title first, status smaller ("New"/"Active"/"Done"), removed chevron, click to expand (no arrow)
5. **All pages** — Goals, Brain Dump, Watch List, Tracker, Daily Todos, API Usage, KB, Vault: compact headers

---

### Remaining / TODO

- [ ] Goal cards: test click-to-expand with a goal that has description
- [ ] Goal overflow menu: test Edit/Delete on mobile
- [ ] Forms: mobile full-width inputs, stacked layout (plan mentioned)
- [ ] User to add OPENAI_API_KEY and test AI features with GPT-5-nano

---

### Files changed this session

- `src/components/goals/goals-list.tsx` — click-to-expand, overflow menu on mobile
