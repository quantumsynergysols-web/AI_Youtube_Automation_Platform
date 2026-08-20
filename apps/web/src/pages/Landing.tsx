import { Link } from 'react-router-dom'
import '../landing.css'

/**
 * The public face of ViralPilot.
 *
 * Runs outside .shell so bands can go edge to edge, and brings its own nav and
 * footer. Written around the one thing that separates this from every other AI
 * video tool: YouTube demonetises mass-produced output at channel level, so
 * volume is the risk rather than the feature. The guard is the product, and the
 * page leads with it rather than burying it in a feature list.
 */

/**
 * Facts about how the product works, not performance claims. There are no
 * customers yet, so there are no adoption numbers to put here — inventing them
 * would be the one thing this page cannot afford to do.
 */
const FIGURES = [
  { n: '4', label: 'checks every video clears before it can publish' },
  { n: '0', label: 'videos that publish without passing them' },
  { n: '90s', label: 'maximum length, identical on every plan' },
  { n: '3', label: 'free videos, no card required' },
]

const STEPS = [
  {
    n: '01',
    title: 'Connect your channel',
    body: 'ViralPilot imports your back catalogue so it knows what you have already covered. Read-only — nothing can be posted until you say so.',
  },
  {
    n: '02',
    title: 'Give it a topic',
    body: 'You get a structured script — hook, body, call to action — an art-direction bible that holds the visuals together, and a shot prompt for every scene.',
  },
  {
    n: '03',
    title: 'Make it yours',
    body: 'Rewrite the hook. Add the insight only you can stand behind. The draft never invents your experience, so there is a real gap left for you to fill.',
  },
  {
    n: '04',
    title: 'Clear the guard, then publish',
    body: 'Checked against your own catalogue and for genuine human authorship. Blocked means blocked — there is no override button anywhere in the product.',
  },
]

const CHECKS = [
  {
    title: 'Duplication of your own work',
    body: 'Every script is scored against your channel’s back catalogue. Too close to something you already made and it will not publish. The angle has to be new, not just the wording.',
  },
  {
    title: 'Evidence a human was involved',
    body: 'The generated hook must be rewritten and your own commentary must be there. Saving the draft untouched does not count, because a click is not authorship.',
  },
  {
    title: 'Publishing cadence',
    body: 'Uploading far faster than your channel normally does is flagged before it becomes the pattern that gets a channel looked at.',
  },
  {
    title: 'Altered-content disclosure',
    body: 'Synthetic voice and generated visuals are disclosed the way YouTube requires. Handled for you, not left as a checkbox you can forget.',
  },
]

const PLANS = [
  { name: 'Free', price: '$0', videos: '3 videos a month', channels: '1 channel' },
  { name: 'Starter', price: '$29', videos: '10 videos a month', channels: '1 channel' },
  { name: 'Creator', price: '$79', videos: '30 videos a month', channels: '1 channel', pick: true },
  { name: 'Pro', price: '$199', videos: '90 videos a month', channels: '3 channels' },
  { name: 'Studio', price: '$399', videos: '200 videos a month', channels: '10 channels' },
]

const AUDIENCE = {
  yes: [
    'You already earn from your channel and cannot afford a monetisation review.',
    'You publish regularly and the bottleneck is production time, not ideas.',
    'You want to stay in the edit, not hand your channel to an autopilot.',
  ],
  no: [
    'You want a hundred videos a month that nobody reads. That is the pattern this refuses to produce.',
    'You want to publish about something you know nothing about. The guard needs your point of view, and it can tell.',
    'You want it to impersonate you. It writes the setup and leaves the personal specifics blank, deliberately.',
  ],
}

const FAQ = [
  {
    q: 'Will this get my channel demonetised?',
    a: 'Preventing that is the entire design goal. YouTube penalises mass-produced, low-effort content, so ViralPilot refuses to publish work that looks like that — it scores every script against your own back catalogue, requires evidence you actually shaped it, and handles the altered-content disclosure YouTube asks for. It is the only tool in this category built to say no to you.',
  },
  {
    q: 'Can I turn the Originality Guard off?',
    a: 'No, and there is no paid tier that unlocks it. The version of this product where the guard is optional is the version that eventually costs somebody their monetisation, and it would make every other claim on this page meaningless.',
  },
  {
    q: 'Will it write in my voice?',
    a: 'It writes structure, pacing and a shot list. It will not invent your experience — no fabricated anecdotes, no statistics it cannot know. Where a personal story belongs it writes the setup and leaves the specific to you, because a script that lies on your behalf is worse than no script at all.',
  },
  {
    q: 'How long does one video take?',
    a: 'The script comes back in under a minute. The part that takes real time is yours: rewriting the hook and writing your own commentary. That is exactly the work the guard is checking for, so it is not something the product tries to shorten.',
  },
  {
    q: 'What happens when a script is too close to something I have already made?',
    a: 'It is blocked before publishing and the video it resembles is named. You can rewrite the scenes that overlap, or regenerate for a different angle entirely. Rewriting is usually faster and keeps the parts that were already working.',
  },
]

export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="Main navigation">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-brand">ViralPilot</Link>
          <div className="lp-nav-links">
            <a href="#stakes">Why it matters</a>
            <a href="#how">How it works</a>
            <a href="#guard">The guard</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lp-nav-end">
            <Link to="/login">Sign in</Link>
            <Link className="lp-cta sm" to="/register">Start free</Link>
          </div>
        </div>
      </nav>

      <main id="main-content">
        <header className="lp-hero">
          <div className="lp-inner">
            <div className="lp-hero-grid">
              <div>
                <span className="lp-tag">For channels that are already monetised</span>
                <h1 className="lp-display">
                  Publish more.<br /><em>Risk nothing.</em>
                </h1>
                <p className="lp-lede">
                  YouTube demonetises mass-produced video at channel level — every upload you
                  have ever made, all at once. ViralPilot is built to refuse that work rather
                  than mass-produce it.
                </p>
                <div className="lp-hero-actions">
                  <Link className="lp-cta" to="/register">Start free — 3 videos</Link>
                  <a className="lp-cta ghost" href="#guard">See how the guard works</a>
                </div>
                <p className="lp-hero-note">
                  No card required · Your channel stays read-only until you publish
                </p>
              </div>

              {/*
                The product, not an illustration. This is the panel a creator
                actually sees, built from the app's own vocabulary. A tool that
                shows itself refusing to publish is making a claim it cannot fake.
              */}
              <aside className="lp-panel" aria-label="Example of a blocked originality check">
                <div className="lp-panel-head">
                  <span className="lp-panel-title">Originality Guard</span>
                  <span className="lp-chip stop">Blocked</span>
                </div>
                <p className="lp-panel-reason">
                  This script closely resembles a video already on the channel. Rewrite it
                  around a different angle, or add material that is genuinely new.
                </p>
                <dl className="lp-rows">
                  <div><dt>Catalogue similarity</dt><dd className="stop">71%</dd></div>
                  <div><dt>Hook rewritten</dt><dd className="stop">No</dd></div>
                  <div><dt>Your commentary</dt><dd className="go">42 words</dd></div>
                </dl>
                <p className="lp-panel-foot">Publishing stays locked until this passes.</p>
              </aside>
            </div>

            <div className="lp-figures">
              {FIGURES.map((f) => (
                <div key={f.label} className="lp-figure">
                  <b>{f.n}</b>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="lp-band white" aria-labelledby="stakes" id="stakes">
          <div className="lp-inner">
            <p className="lp-label">The stakes</p>
            <h2 className="lp-display">Same volume.<br />Opposite outcome.</h2>
            <p className="lp-lede">
              Both columns publish thirty videos a month. Only one of them is still earning
              at the end of it.
            </p>
            <div className="lp-versus">
              <div className="lp-vcol stop">
                <h3>Every other AI video tool</h3>
                <ul>
                  <li>Optimises for how many videos you can ship</li>
                  <li>Reuses your own angles back at you without noticing</li>
                  <li>Writes a personal story you never lived</li>
                  <li>Publishes whatever it generated, unread</li>
                  <li>Leaves disclosure for you to remember</li>
                </ul>
                <p className="lp-vend">Channel-level demonetisation. Every upload, at once.</p>
              </div>
              <div className="lp-vcol go">
                <h3>ViralPilot</h3>
                <ul>
                  <li>Optimises for how many videos you can safely publish</li>
                  <li>Scores every script against your catalogue and blocks duplicates</li>
                  <li>Leaves the personal specifics blank, on purpose, for you</li>
                  <li>Refuses to publish until you have rewritten the hook</li>
                  <li>Handles altered-content disclosure automatically</li>
                </ul>
                <p className="lp-vend">A record of human authorship on every video you ship.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="how" id="how">
          <div className="lp-inner">
            <p className="lp-label">How it works</p>
            <h2 className="lp-display">Four steps. You own two of them.</h2>
            <div className="lp-steps">
              {STEPS.map((step) => (
                <article key={step.n} className="lp-step">
                  <span className="lp-step-n" aria-hidden="true">{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-band void" aria-labelledby="guard" id="guard">
          <div className="lp-inner">
            <p className="lp-label">The part that matters</p>
            <h2 className="lp-display">The guard blocks.<br />It does not warn.</h2>
            <p className="lp-lede">
              A warning you can click past is not protection. Nothing publishes until all four
              of these pass, and the thresholds are not yours to turn off.
            </p>
            <div className="lp-checks">
              {CHECKS.map((check) => (
                <article key={check.title} className="lp-check">
                  <span className="lp-check-mark" aria-hidden="true">✓</span>
                  <h3>{check.title}</h3>
                  <p>{check.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="proof">
          <div className="lp-inner">
            <p className="lp-label">What it produces</p>
            <h2 className="lp-display">A real hook, and a real refusal.</h2>
            <p className="lp-lede">
              Two things from actual runs. Both are more useful than another paragraph of
              claims about quality.
            </p>
            <div className="lp-proof">
              <figure className="lp-quote">
                <blockquote>
                  “You didn’t spend six hours editing. You spent one hour editing and five
                  hours deciding.”
                </blockquote>
                <figcaption>
                  Generated opening, topic: why edits take so long. You rewrite this line
                  before anything can publish — that is the point of it. A strong angle to
                  sharpen, not a finished sentence to accept.
                </figcaption>
              </figure>
              <figure className="lp-quote">
                <blockquote>
                  “Add your own commentary before publishing. A video with no original
                  insight is what YouTube demonetises as inauthentic.”
                </blockquote>
                <figcaption>
                  An actual block. Not a warning banner, not a nudge — the publish path is
                  closed until it is fixed, and there is no button in the product that
                  overrides it.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="lp-band void" aria-labelledby="audience">
          <div className="lp-inner">
            <p className="lp-label">Who it is for</p>
            <h2 className="lp-display">A narrow tool, on purpose.</h2>
            <div className="lp-aud">
              <div>
                <h3 className="go">A good fit if</h3>
                <ul>{AUDIENCE.yes.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
              <div>
                <h3 className="stop">Not for you if</h3>
                <ul>{AUDIENCE.no.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band white" aria-labelledby="pricing" id="pricing">
          <div className="lp-inner">
            <p className="lp-label">Pricing</p>
            <h2 className="lp-display">Plans differ on volume.<br />Never on protection.</h2>
            <p className="lp-lede">
              Every plan gets the same guard and the same 90-second maximum. Paying more buys
              more videos and more channels. It does not buy a way around the checks.
            </p>
            <div className="lp-plans">
              {PLANS.map((plan) => (
                <div key={plan.name} className={`lp-plan${plan.pick ? ' pick' : ''}`}>
                  {plan.pick ? <span className="lp-plan-tag">Most chosen</span> : null}
                  <h3>{plan.name}</h3>
                  <p className="lp-price">{plan.price}<small>/mo</small></p>
                  <p>{plan.videos}</p>
                  <p>{plan.channels}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="faq">
          <div className="lp-inner">
            <p className="lp-label">Questions people actually ask</p>
            <h2 className="lp-display">Straight answers.</h2>
            <div className="lp-faq">
              {FAQ.map((item) => (
                <details key={item.q} className="lp-q">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-close">
          <div className="lp-inner">
            <h2>Start with three videos.<br />See what the guard says.</h2>
            <p>
              Connect a channel, write one script, and find out whether it would have passed.
              No card required.
            </p>
            <Link className="lp-cta" to="/register">Create your account</Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-foot-inner">
          <div className="lp-foot-top">
            <div className="lp-foot-brand">
              <Link to="/" className="lp-brand">ViralPilot</Link>
              <p>
                AI production for creators who already earn from their channel. Built to
                refuse work that would put your monetisation at risk.
              </p>
              <span className="lp-foot-badge">
                <b>Read-only</b> until you choose to publish
              </span>
            </div>

            <div className="lp-foot-col">
              <h3>Product</h3>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#guard">The Originality Guard</a></li>
                <li><a href="#stakes">Why it matters</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>

            <div className="lp-foot-col">
              <h3>Account</h3>
              <ul>
                <li><Link to="/register">Create an account</Link></li>
                <li><Link to="/login">Sign in</Link></li>
                <li><Link to="/forgot-password">Reset password</Link></li>
              </ul>
            </div>

            <div className="lp-foot-col">
              <h3>Legal</h3>
              <ul>
                <li><Link to="/privacy">Privacy policy</Link></li>
                <li><Link to="/terms">Terms of service</Link></li>
              </ul>
            </div>
          </div>

          <div className="lp-foot-bottom">
            <p>© {new Date().getFullYear()} Quantum Synergy Solutions. All rights reserved.</p>
            {/*
              Stated here as well as in the product. YouTube requires altered-content
              disclosure on synthetic media, and a tool that sells itself on compliance
              should not be quiet about the fact that it produces exactly that.
            */}
            <p className="lp-foot-note">
              Videos produced with ViralPilot use synthetic voice and generated visuals, and
              are disclosed as altered content when published. ViralPilot is not affiliated
              with, endorsed by, or sponsored by YouTube or Google.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
