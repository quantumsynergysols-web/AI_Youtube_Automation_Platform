import { Link } from 'react-router-dom'
import { MarketingPage, PageHead } from '../components/Marketing'
import { AUDIENCE } from './marketing-content'

export default function About() {
  return (
    <MarketingPage>
      <PageHead
        label="About"
        title={<>We built the tool that<br />tells you no.</>}
        lede="ViralPilot is made by Quantum Synergy Solutions. It exists because the obvious version of this product — generate as many videos as possible — is the version that gets channels demonetised."
      />

      <section className="lp-band">
        <div className="lp-inner lp-narrow" data-reveal>
          <div className="lp-prose">
            <h2>Why this exists</h2>
            <p>
              YouTube&rsquo;s Inauthentic Content policy does not penalise videos. It penalises
              channels — and it does so across everything you have ever uploaded, at once. For
              a creator whose income depends on that channel, a tool optimised purely for
              output volume is not a productivity gain. It is a risk with a subscription fee.
            </p>
            <p>
              Every other product in this category competes on how many videos it can make.
              That number is the exact signal the policy looks for. So we built the opposite:
              a tool that produces fewer videos, refuses some of them outright, and requires
              the creator to do the part that cannot be automated.
            </p>

            <h2>What we will not do</h2>
            <p>
              <strong>We will not let you turn the guard off.</strong> Not on any plan, not by
              request. A product where compliance is a setting is a product that eventually
              costs somebody their livelihood, and it would make everything else we say
              meaningless.
            </p>
            <p>
              <strong>We will not invent your experience.</strong> The scriptwriter is
              instructed never to write a personal anecdote, a client, or a statistic it
              cannot know. A script that puts a lie in your mouth is worse than no script, and
              fabricated commentary would satisfy the guard dishonestly — which would defeat
              the only thing we are actually selling.
            </p>
            <p>
              <strong>We will not promise you an outcome.</strong> The guard substantially
              reduces the risk that a video looks mass-produced. It cannot guarantee any
              platform decision, and anyone in this market telling you otherwise is selling
              you something they cannot deliver.
            </p>

            <h2>Where it is up to</h2>
            <p>
              ViralPilot is in active development. Scripting, the Originality Guard, the human
              checkpoint and channel connection are built and working. Voice, visuals and
              publishing are being built now. We would rather say that plainly than describe a
              finished product that does not exist yet.
            </p>
          </div>
        </div>
      </section>

      <section className="lp-band tint" aria-labelledby="fit-h">
        <div className="lp-inner" data-reveal>
          <p className="lp-label">Who it is for</p>
          <h2 className="lp-display" id="fit-h">A narrow tool, on purpose.</h2>
          <div className="lp-aud">
            <div data-stagger>
              <h3 className="go">A good fit if</h3>
              <ul>{AUDIENCE.yes.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
            <div data-stagger>
              <h3 className="stop">Not for you if</h3>
              <ul>{AUDIENCE.no.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-close">
        <div className="lp-inner" data-reveal>
          <h2>Try it on one video.</h2>
          <p>Three free, no card. If the output is not something you would publish, tell us why.</p>
          <Link className="lp-cta" to="/register">Start free</Link>
        </div>
      </section>
    </MarketingPage>
  )
}
