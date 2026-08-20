import { Link } from 'react-router-dom'
import { MarketingPage } from '../components/Marketing'
import { AUDIENCE, CHECKS, FAQ, FIGURES, PLANS, STEPS } from './marketing-content'

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
export default function Landing() {
  return (
    <MarketingPage>
        <header className="lp-hero">
          <div className="lp-inner" data-reveal>
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
                <div key={f.label} className="lp-figure" data-stagger>
                  <b>{f.n}</b>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="lp-band tint" aria-labelledby="stakes" id="stakes">
          <div className="lp-inner" data-reveal>
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
          <div className="lp-inner" data-reveal>
            <p className="lp-label">How it works</p>
            <h2 className="lp-display">Four steps. You own two of them.</h2>
            <div className="lp-steps">
              {STEPS.map((step) => (
                <article key={step.n} className="lp-step" data-stagger>
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

        <section className="lp-band sunk" aria-labelledby="guard" id="guard">
          <div className="lp-inner" data-reveal>
            <p className="lp-label">The part that matters</p>
            <h2 className="lp-display">The guard blocks.<br />It does not warn.</h2>
            <p className="lp-lede">
              A warning you can click past is not protection. Nothing publishes until all four
              of these pass, and the thresholds are not yours to turn off.
            </p>
            <div className="lp-checks">
              {CHECKS.map((check) => (
                <article key={check.title} className="lp-check" data-stagger>
                  <span className="lp-check-mark" aria-hidden="true">✓</span>
                  <h3>{check.title}</h3>
                  <p>{check.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="proof">
          <div className="lp-inner" data-reveal>
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

        <section className="lp-band tint" aria-labelledby="audience">
          <div className="lp-inner" data-reveal>
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

        <section className="lp-band" aria-labelledby="pricing" id="pricing">
          <div className="lp-inner" data-reveal>
            <p className="lp-label">Pricing</p>
            <h2 className="lp-display">Plans differ on volume.<br />Never on protection.</h2>
            <p className="lp-lede">
              Every plan gets the same guard and the same 90-second maximum. Paying more buys
              more videos and more channels. It does not buy a way around the checks.
            </p>
            <div className="lp-plans">
              {PLANS.map((plan) => (
                <div key={plan.name} className={`lp-plan${plan.pick ? ' pick' : ''}`} data-stagger>
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

        <section className="lp-band tint" aria-labelledby="faq">
          <div className="lp-inner" data-reveal>
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
          <div className="lp-inner" data-reveal>
            <h2>Start with three videos.<br />See what the guard says.</h2>
            <p>
              Connect a channel, write one script, and find out whether it would have passed.
              No card required.
            </p>
            <Link className="lp-cta" to="/register">Create your account</Link>
          </div>
        </section>
    </MarketingPage>
  )
}
