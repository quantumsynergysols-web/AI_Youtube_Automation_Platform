import { Link } from 'react-router-dom'

/**
 * The public face of ViralPilot.
 *
 * Written around the one thing that separates this from every "AI video
 * generator": YouTube's Inauthentic Content policy demonetises mass-produced
 * output at channel level, so shipping volume is the risk rather than the
 * product. The Originality Guard is what is actually being sold, and the page
 * leads with it instead of burying it under a feature list.
 */

const STEPS = [
  {
    n: '01',
    title: 'Connect your channel',
    body: 'ViralPilot reads your back catalogue so it knows what you have already covered. Read-only until you choose to publish.',
  },
  {
    n: '02',
    title: 'Give it a topic',
    body: 'It writes a structured script — hook, body, call to action — plus an art-direction bible and a shot prompt for every scene.',
  },
  {
    n: '03',
    title: 'Make it yours',
    body: 'Rewrite the hook. Add the insight only you can stand behind. The draft never invents your experience, so there is a real gap for you to fill.',
  },
  {
    n: '04',
    title: 'Pass the guard, then publish',
    body: 'Every video is checked against your own catalogue and for genuine human authorship before it can go out.',
  },
]

const GUARD_CHECKS = [
  {
    title: 'Duplication of your own work',
    body: 'Scripts are scored against your channel’s back catalogue. Too close to a video you already made and it will not publish — the angle has to be new, not just the wording.',
  },
  {
    title: 'Evidence a human was involved',
    body: 'The generated hook has to be rewritten and your own commentary has to be there. Saving the draft untouched does not count, because a click is not authorship.',
  },
  {
    title: 'Publishing cadence',
    body: 'Uploading far faster than usual is flagged before it becomes the pattern that draws attention to a channel.',
  },
  {
    title: 'Disclosure',
    body: 'Synthetic voice and generated visuals are disclosed as YouTube requires. Not optional, not a checkbox you can forget.',
  },
]

const PLANS = [
  { name: 'Free', price: '$0', videos: '3 videos / month', channels: '1 channel' },
  { name: 'Starter', price: '$29', videos: '10 videos / month', channels: '1 channel' },
  { name: 'Creator', price: '$79', videos: '30 videos / month', channels: '1 channel', featured: true },
  { name: 'Pro', price: '$199', videos: '90 videos / month', channels: '3 channels' },
  { name: 'Studio', price: '$399', videos: '200 videos / month', channels: '10 channels' },
]

const AUDIENCE = {
  yes: [
    'You already earn from your channel and cannot afford a monetisation review.',
    'You publish regularly and the bottleneck is production time, not ideas.',
    'You want to be in the edit, not to hand the channel to an autopilot.',
  ],
  no: [
    'You want a hundred videos a month with nobody reading them. That is the pattern this refuses to produce.',
    'You want to publish about a topic you know nothing about. The guard requires your own point of view, and it can tell the difference.',
    'You want the tool to impersonate you. It writes the setup and leaves the personal specifics blank on purpose.',
  ],
}

const FAQ = [
  {
    q: 'Does this get my channel banned?',
    a: 'The opposite is the entire design goal. YouTube penalises mass-produced, low-effort content — so ViralPilot refuses to publish work that looks like that, checks every script against your own back catalogue, and requires evidence you actually shaped it. It also handles the altered-content disclosure YouTube requires for synthetic voice and visuals.',
  },
  {
    q: 'Can I turn the Originality Guard off?',
    a: 'No. That is deliberate. The version of this product where the guard is optional is the version that eventually costs someone their monetisation, and it would also make every other claim here meaningless.',
  },
  {
    q: 'Will it write in my voice?',
    a: 'It writes structure, pacing and a shot list. It will not invent your experience — no fabricated anecdotes, no numbers it cannot know. Where a personal story belongs it writes the setup and leaves the specific to you, because a script that lies on your behalf is worse than no script.',
  },
  {
    q: 'How long does a video take?',
    a: 'A script comes back in under a minute. The part that takes real time is yours: rewriting the hook and adding your own commentary. That is the work the guard is checking for, so it is not something the product tries to shorten.',
  },
  {
    q: 'What happens when a script is too similar to something I have made?',
    a: 'It is blocked before publishing, and named — you are told which video it resembles. You can rewrite the scenes that overlap, or regenerate for a different angle. Rewriting is usually faster and keeps the parts that were already good.',
  },
]

export default function Landing() {
  return (
    <main className="landing" id="main-content">
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">For channels that are already monetised</span>
          <h1>
            Publish more.<br />
            <span className="hero-em">Risk nothing.</span>
          </h1>
          <p className="hero-lede">
            YouTube demonetises mass-produced video at channel level — every upload you
            have ever made, at once. ViralPilot is the only one of these tools built to
            refuse that work rather than mass-produce it.
          </p>
          <div className="row hero-actions">
            <Link className="button-link" to="/register">Start free — 3 videos</Link>
            <a className="button-link ghost-link" href="#guard">See how the guard works</a>
          </div>
          <p className="hero-note">No card required · Your channel stays read-only until you publish</p>
        </div>

        {/*
          The product, not a stock illustration. This is the verdict panel a
          creator actually sees, rendered from the same vocabulary the app uses —
          a tool that shows itself refusing to publish is making a claim it
          cannot fake, which is a stronger opening than any adjective.
        */}
        <aside className="hero-visual" aria-label="Example of a blocked originality check">
          <div className="verdict-panel">
            <div className="verdict-head">
              <span className="verdict-label">Originality Guard</span>
              <span className="verdict-chip blocked">Blocked</span>
            </div>
            <p className="verdict-reason">
              This script closely resembles a video already on the channel. Rewrite it around
              a different angle, or add material that is genuinely new.
            </p>
            <dl className="verdict-stats">
              <div><dt>Catalogue similarity</dt><dd className="bad">71%</dd></div>
              <div><dt>Hook rewritten</dt><dd className="bad">No</dd></div>
              <div><dt>Your commentary</dt><dd className="good">42 words</dd></div>
            </dl>
            <p className="verdict-foot">Publishing stays locked until this passes.</p>
          </div>
        </aside>
      </section>

      <section className="landing-section" aria-labelledby="stakes">
        <p className="eyebrow">The stakes</p>
        <h2 id="stakes">Same volume. Opposite outcome.</h2>
        <p className="section-lede">
          Both columns publish thirty videos a month. Only one of them is still monetised
          at the end of it.
        </p>
        <div className="versus">
          <div className="versus-col bad">
            <span className="versus-tag">Every other AI video tool</span>
            <ul>
              <li>Optimises for how many videos you can ship</li>
              <li>Reuses your own angles back at you without noticing</li>
              <li>Writes a personal story you never lived</li>
              <li>Publishes whatever it generated, unread</li>
              <li>Leaves disclosure to you to remember</li>
            </ul>
            <p className="versus-end">Channel-level demonetisation. Every upload, at once.</p>
          </div>
          <div className="versus-col good">
            <span className="versus-tag">ViralPilot</span>
            <ul>
              <li>Optimises for how many videos you can safely publish</li>
              <li>Scores every script against your back catalogue and blocks duplicates</li>
              <li>Leaves the personal specifics blank, on purpose, for you</li>
              <li>Refuses to publish until you have rewritten the hook</li>
              <li>Handles altered-content disclosure automatically</li>
            </ul>
            <p className="versus-end">A record of human authorship on every video you ship.</p>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="how">
        <p className="eyebrow">How it works</p>
        <h2 id="how">Four steps, and you are in control of two of them.</h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.n} className="step">
              <span className="step-n" aria-hidden="true">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section guard-section" aria-labelledby="guard">
        <p className="eyebrow">The part that matters</p>
        <h2 id="guard">The Originality Guard blocks. It does not warn.</h2>
        <p className="section-lede">
          A warning you can click past is not protection. Nothing publishes until these pass,
          and the thresholds are not yours to turn off — because the version of this product
          where you can disable the guard is the version that gets your channel demonetised.
        </p>
        <div className="guard-grid">
          {GUARD_CHECKS.map((check) => (
            <div key={check.title} className="guard-card">
              <h3>{check.title}</h3>
              <p>{check.body}</p>
            </div>
          ))}
        </div>
        <p className="muted guard-footnote">
          Every check is recorded against the video — what changed, how long you spent, what it
          was compared against. If a decision ever has to be appealed, that record is the
          evidence.
        </p>
      </section>

      <section className="landing-section" aria-labelledby="proof">
        <p className="eyebrow">What it actually produces</p>
        <h2 id="proof">A real hook, and a real refusal.</h2>
        <p className="section-lede">
          Two things from actual runs — the opening line of a generated script, and the guard
          declining to publish. Both are more useful than another paragraph of claims.
        </p>
        <div className="proof-grid">
          <figure className="proof-card">
            <figcaption className="proof-label">Generated opening · topic: why edits take so long</figcaption>
            <blockquote className="proof-quote">
              &ldquo;You didn&rsquo;t spend six hours editing. You spent one hour editing and five
              hours deciding.&rdquo;
            </blockquote>
            <p className="muted">
              You rewrite this line before anything can publish. That is the point of it — a
              strong angle to sharpen, not a finished sentence to accept.
            </p>
          </figure>
          <figure className="proof-card blocked">
            <figcaption className="proof-label">Guard verdict</figcaption>
            <p className="proof-verdict">Publishing blocked</p>
            <p className="proof-reason">
              This script closely resembles a video already on the channel. Rewrite it around a
              different angle, or add material that is genuinely new.
            </p>
            <p className="muted">
              Blocked, not warned. There is no button here that lets you publish it anyway.
            </p>
          </figure>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="audience">
        <p className="eyebrow">Who it is for</p>
        <h2 id="audience">This is a narrow tool, on purpose.</h2>
        <div className="split">
          <div className="audience-col">
            <h3 className="audience-head yes">A good fit if</h3>
            <ul className="audience-list">
              {AUDIENCE.yes.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="audience-col">
            <h3 className="audience-head no">Not for you if</h3>
            <ul className="audience-list">
              {AUDIENCE.no.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="pricing">
        <p className="eyebrow">Pricing</p>
        <h2 id="pricing">Plans differ on volume, not on protection.</h2>
        <p className="section-lede">
          Every plan gets the same guard and the same 90-second maximum. Paying more buys more
          videos and more channels — it does not buy a way around the checks.
        </p>
        <div className="plan-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`plan-card${plan.featured ? ' featured' : ''}`}>
              {plan.featured ? <span className="plan-tag">Most chosen</span> : null}
              <h3>{plan.name}</h3>
              <p className="plan-price">{plan.price}<span className="plan-period">/mo</span></p>
              <p className="plan-line">{plan.videos}</p>
              <p className="plan-line muted">{plan.channels}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="faq">
        <p className="eyebrow">Questions people actually ask</p>
        <h2 id="faq">Straight answers.</h2>
        <div className="faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Start with three videos, free.</h2>
        <p>Connect a channel, write one script, and see what the guard says about it.</p>
        <Link className="button-link" to="/register">Create your account</Link>
      </section>
    </main>
  )
}
