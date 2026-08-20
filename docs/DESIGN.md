# ViralPilot — Frontend Design System

Binding for every change under `apps/web`. If a task conflicts with this document,
say so in the PR rather than quietly deviating.

The product is sold to creators who already earn money from their channels. They have
seen a lot of AI tools and they are suspicious of them. The interface has to read as
something built by people who understand YouTube, not as a wrapper around an API. That
is what "professional" means here — not decoration.

---

## 1. Non-negotiables

1. **Use the tokens.** Every colour comes from a CSS custom property in `styles.css`.
   No raw hex in a component, ever. If you need a colour that does not exist, add a
   token and say why in the PR.
2. **No new dependencies.** No component library, no CSS framework, no icon package,
   no animation library. The entire UI is hand-written CSS against those tokens. A
   dependency added for one screen becomes a dependency the whole product carries.
3. **Extend, do not restyle.** `Login`, `Register`, `Channels`, `Billing`,
   `ScriptReview` and `Landing` already establish the language. New screens join it.
   Never introduce a second visual system in one corner of the app.
4. **Testable logic leaves the component.** Anything with a rule in it — ordering,
   thresholds, formatting, state derivation — goes in a `*.logic.ts` beside the page
   with tests. This is why `script-review.logic.ts` and `dashboard.logic.ts` exist.
5. **Every screen handles four states**: loading, empty, error, and populated. A screen
   that only looks right when the data arrives is unfinished. `LoadingState` and
   `PageState` exist for the first three.

---

## 2. Tokens

Defined at the top of `src/styles.css`. Learn these rather than inventing near-misses.

| Token | Use for |
|---|---|
| `--ground` | The page behind everything |
| `--surface` | Cards, panels, anything raised off the ground |
| `--surface-2` | A panel inside a panel; subtle zoning |
| `--ink` | Headings and primary text |
| `--ink-2` | Body copy |
| `--muted` | Secondary and supporting text |
| `--rule` | Every border and divider |
| `--accent` / `--accent-dark` | Primary actions, active state, focus |
| `--accent-soft` | Accent-tinted backgrounds |
| `--ok` / `--ok-soft` | Success, passed checks |
| `--stop` / `--stop-soft` | Errors, blocked states |
| `--info` / `--info-soft` | Neutral information |

**The accent is teal (`#087b78`), and it is load-bearing.** It marks what is actionable
and what has passed. Do not spend it on decoration — a page where everything is teal
tells the reader nothing.

**Semantic colour is separate from the accent.** Green means passed, red means blocked,
amber means needs-you. These never double as brand colour, and brand colour never
implies a state.

---

## 3. Typography

- The system stack in `:root`. Do not add a webfont.
- `h1` per page, once. `h2` for sections. `h3` for cards. Do not skip levels to get a
  size — that breaks screen readers to save a CSS line.
- `.eyebrow` above a heading for the category label. Uppercase, letter-spaced, accent
  coloured. It orients; it is not decoration, so do not add one where the heading is
  already self-explanatory.
- Body copy stays near 65–75 characters wide. On a wide screen that means constraining
  the text container, not letting it run the full 1040px.
- `font-variant-numeric: tabular-nums` anywhere digits stack in a column — prices,
  counts, durations, token figures.

---

## 4. Layout

- `.shell` caps content at 1040px. Everything lives inside it.
- Compose with flex or grid and `gap`. Never space siblings with per-element margins;
  they collapse and double in ways that are invisible until they are not.
- `.stack` for vertical rhythm, `.row` for horizontal groups, `.card` for panels.
- Grids use `repeat(auto-fit, minmax(<min>, 1fr))` so they reflow without breakpoints.
- Anything that can overflow — tables, code, long prompts — scrolls inside its own
  container. **The page body must never scroll sideways.** Check at 375px before you
  open a PR.
- One breakpoint at 760px is usually enough. If you find yourself adding a third, the
  layout is fighting you.

---

## 5. Writing the interface

Copy is design material here, not filler. Most of the trust this product needs is won
or lost in these sentences.

- **Write from the creator's side.** They have "videos", not "render jobs". They have a
  "channel", not an "OAuth grant".
- **Say what happens.** A button says `Save commentary`, and the confirmation says
  `Commentary saved`. Never `Submit`, never `OK`.
- **Errors state the cause and the fix.** "The scriptwriter declined this topic.
  Rephrase it, then generate again." Not "Something went wrong."
- **Never claim a state that is not true.** This is the one that matters most. When
  someone saves the generated hook untouched, the screen says so plainly — it does not
  show a green tick because a request succeeded. The guard's whole value is that it
  cannot be satisfied by going through the motions, and an interface that implies
  otherwise is lying on the guard's behalf.
- **Explain a block, then route to the fix.** A blocked state that does not say what to
  do next is a dead end.
- Sentence case everywhere. No exclamation marks. No emoji as UI furniture.

---

## 6. Interaction

- Every interactive element has a visible `:focus-visible` state. Keyboard users are
  not optional.
- Any action that hits the network gets a pending state, and the control is disabled
  while it runs. Two clicks must never send two requests.
- Destructive and expensive actions confirm first, and the confirmation names what is
  lost. Regeneration says the hook edit is cleared and the commentary is kept —
  because that is exactly what someone is afraid of.
- Respect `prefers-reduced-motion`. Motion is a garnish; the interface must work
  without any.
- Long operations show real progress. A script generation takes 35–55 seconds; a
  spinner with no elapsed time reads as a hang.

---

## 7. Aesthetics to avoid

These read as machine-generated and will be sent back:

- Purple-to-blue gradient heroes.
- Inter, Roboto, or Space Grotesk pulled in as a "safe" font.
- Emoji as section markers or status icons.
- Everything centred. Left-aligned text is easier to read; centre only short hero copy.
- Rounded-everything with a uniform drop shadow on every card.
- Numbered step markers (01 / 02 / 03) where the content is not genuinely a sequence.
  On the landing page it is a real process, so they are earned. In a settings list they
  are not.
- Icon-only buttons with no label.

---

## 8. Definition of done

Before opening a PR:

- [ ] `npm run build` passes (this runs `tsc --noEmit` first).
- [ ] Web tests pass, and new rule-bearing logic has tests.
- [ ] Loading, empty, error and populated states all verified by hand.
- [ ] Checked at 375px — no horizontal scroll on the body.
- [ ] Tabbed through the screen; focus is visible and the order is sensible.
- [ ] No raw hex, no new dependency, no second visual system.
- [ ] Every error path shows a message naming the cause and the next step.

---

## 9. Reference implementations

Read these before writing a new screen:

- `src/pages/Landing.tsx` — public marketing page, section rhythm, plan grid.
- `src/pages/ScriptReview.tsx` — the most complex screen; state handling, honest
  status copy, guard integration.
- `src/pages/script-review.logic.ts` — how rule-bearing logic is extracted and tested.
- `src/pages/Channels.tsx` — list, empty state, connect flow.
- `src/components/PageState.tsx` — the shared loading/empty/error component.

---

## 10. Marketing pages

Derived from reviewing Ocoya, Sera and Quantum Framer. Structural patterns worth
keeping, not aesthetics worth copying.

**Section order that works.** Hero → the problem → how it works → the differentiator →
proof → who it is for → pricing → FAQ → closing CTA. `Landing.tsx` follows exactly
this. A visitor should be able to stop after any section and have learned something
complete.

**Proof beats claims, and it is the section most often skipped.** Sera shows real
replies its product generated rather than describing them. The equivalent here is
showing an actual generated hook next to an actual guard refusal — the refusal is the
more persuasive of the two, because a product that shows itself saying no is making a
claim it cannot fake. When you add a feature, ask what artifact it produces and show
that instead of adjectives.

**Nav has to reach the sections.** A long page with no in-page nav makes a visitor
scroll to work out whether scrolling is worth it. Signed-out nav is `How it works`,
`The guard`, `Pricing`, then `Sign in` and a primary CTA. Signed-in nav is the app.
The two never mix.

**Name who it is not for.** Quantum Framer's "Honest status: live and evolving" is the
same instinct. Saying plainly that this is the wrong tool for someone who wants a
hundred unread videos a month costs a few unqualified signups and buys credibility with
exactly the audience that can afford the product.

**FAQ is objection handling, not documentation.** Answer the thing a sceptical creator
is actually thinking — "will this get my channel banned", "can I turn the guard off" —
and answer it straight, including when the answer is no.

**On the reference sites' aesthetics:** Ocoya and Quantum Framer are dark; Sera runs an
80px ultralight headline. Do not port those here. The app itself is light, and a dark
marketing page handing off to a light product reads as two different products. The
confidence in those headlines is worth taking; the palette is not.
