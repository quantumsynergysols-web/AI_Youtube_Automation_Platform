import { Link } from 'react-router-dom'
import { MarketingPage, PageHead } from '../components/Marketing'
import { FAQ, PLANS } from './marketing-content'

export default function Pricing() {
  return (
    <MarketingPage>
      <PageHead
        label="Pricing"
        title={<>Plans differ on volume.<br />Never on protection.</>}
        lede="Every plan gets the same Originality Guard and the same 90-second maximum. Paying more buys more videos and more channels. It does not buy a way around the checks."
      />

      <section className="lp-band">
        <div className="lp-inner" data-reveal>
          <div className="lp-plans">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`lp-plan${plan.pick ? ' pick' : ''}`} data-stagger>
                {plan.pick ? <span className="lp-plan-tag">Most chosen</span> : null}
                <h3>{plan.name}</h3>
                <p className="lp-price">{plan.price}<small>/mo</small></p>
                <p>{plan.videos}</p>
                <p>{plan.channels}</p>
                <p className="lp-plan-note">{plan.note}</p>
              </div>
            ))}
          </div>
          <p className="lp-fineprint">
            Billed monthly, cancel any time. Unused videos do not roll over. A video counts
            when it is rendered, so rejecting a draft and generating again costs nothing.
          </p>
        </div>
      </section>

      <section className="lp-band tint" aria-labelledby="incl-h">
        <div className="lp-inner" data-reveal>
          <p className="lp-label">On every plan</p>
          <h2 className="lp-display" id="incl-h">Including the free one.</h2>
          <div className="lp-included">
            {[
              'The full Originality Guard, all four checks',
              'Back-catalogue import and duplicate scoring',
              'Art direction and per-scene image prompts',
              'The human checkpoint and its audit trail',
              'Altered-content disclosure on publish',
              '90-second maximum video length',
            ].map((item) => (
              <div key={item} className="lp-incl" data-stagger>
                <span aria-hidden="true">✓</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="pfaq-h">
        <div className="lp-inner" data-reveal>
          <p className="lp-label">Before you pay</p>
          <h2 className="lp-display" id="pfaq-h">Straight answers.</h2>
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
          <h2>Start on the free plan.</h2>
          <p>Three videos, no card. Judge the output before you pay for it.</p>
          <Link className="lp-cta" to="/register">Create your account</Link>
        </div>
      </section>
    </MarketingPage>
  )
}
