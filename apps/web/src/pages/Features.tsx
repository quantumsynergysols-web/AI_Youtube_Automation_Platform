import { Link } from 'react-router-dom'
import { MarketingPage, PageHead } from '../components/Marketing'
import { CHECKS, FEATURES, STEPS } from './marketing-content'

export default function Features() {
  return (
    <MarketingPage>
      <PageHead
        label="Features"
        title={<>Everything here exists to<br />protect the channel.</>}
        lede="ViralPilot is not a general video generator with safety bolted on. Each capability below was built around one constraint: nothing publishes that could make your channel look mass-produced."
      />

      {FEATURES.map((feature, i) => (
        <section key={feature.title} className={`lp-band${i % 2 === 1 ? ' tint' : ''}`}>
          <div className="lp-inner" data-reveal>
            <div className="lp-feature">
              <div>
                <p className="lp-label">{feature.label}</p>
                <h2 className="lp-display">{feature.title}</h2>
                <p className="lp-lede">{feature.body}</p>
              </div>
              <ul className="lp-points">
                {feature.points.map((point) => (
                  <li key={point} data-stagger>{point}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      <section className="lp-band sunk" id="guard" aria-labelledby="guard-h">
        <div className="lp-inner" data-reveal>
          <p className="lp-label">The Originality Guard</p>
          <h2 className="lp-display" id="guard-h">Four checks. No override.</h2>
          <p className="lp-lede">
            A warning you can click past is not protection. Nothing publishes until all four
            pass, and the thresholds are not yours to turn off.
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

      <section className="lp-band" aria-labelledby="flow-h">
        <div className="lp-inner" data-reveal>
          <p className="lp-label">The flow</p>
          <h2 className="lp-display" id="flow-h">Four steps. You own two of them.</h2>
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

      <section className="lp-close">
        <div className="lp-inner" data-reveal>
          <h2>See it block something.</h2>
          <p>Three videos free. Write one script and find out whether it would have passed.</p>
          <Link className="lp-cta" to="/register">Start free</Link>
        </div>
      </section>
    </MarketingPage>
  )
}
