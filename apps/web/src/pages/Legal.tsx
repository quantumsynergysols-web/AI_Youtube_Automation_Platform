import { Link } from 'react-router-dom'
import { MarketingPage } from '../components/Marketing'

/**
 * Privacy policy and terms of service.
 *
 * These exist because Google will not verify an OAuth app that requests YouTube
 * scopes without published, reachable versions of both — so they are a
 * deployment dependency, not paperwork to do later.
 *
 * Written to describe what the system actually does: which data is collected,
 * how OAuth tokens are stored, and every third party that script and media
 * content is sent to. A privacy policy that overstates the protection is worse
 * than none, because it is a claim a regulator can hold you to.
 */

const LAST_UPDATED = '20 August 2026'

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <MarketingPage>
      <section className="lp-band">
        <div className="lp-inner lp-legal" data-reveal>
          <p className="lp-label">Legal</p>
          <h1 className="lp-display">{title}</h1>
          <p className="lp-legal-date">Last updated {LAST_UPDATED}</p>
          {children}
          <p className="lp-legal-back"><Link to="/">Back to ViralPilot</Link></p>
        </div>
      </section>
    </MarketingPage>
  )
}

export function Privacy() {
  return (
    <LegalShell title="Privacy policy">
      <div className="lp-prose">
        <div className="lp-legal-notice">
          <strong>Draft for review.</strong> This describes what the software actually does
          today. It has not been reviewed by a lawyer, and it should be before ViralPilot
          takes real customers or handles data from the EU or UK.
        </div>

        <h2>What we collect</h2>
        <p><strong>Account data.</strong> Your email address and a password hash. We never store your password itself — it is hashed with Argon2id and cannot be reversed.</p>
        <p><strong>YouTube channel data.</strong> When you connect a channel we store its title, ID, subscriber count, and the titles, descriptions and publication dates of your existing videos. The video data is what the Originality Guard compares new scripts against; without it the guard cannot tell whether you are repeating yourself.</p>
        <p><strong>Google OAuth tokens.</strong> Access and refresh tokens for the YouTube scopes you grant. These are encrypted at rest with AES-256-GCM before they are written to the database. They are never logged and never returned by any API response.</p>
        <p><strong>Content you create.</strong> Project topics, generated scripts, your hook rewrites, your commentary, and originality check results — including how long you spent editing. That timing record exists so you have evidence of human authorship if a platform decision ever has to be appealed.</p>
        <p><strong>Billing data.</strong> Handled entirely by Stripe. We store a customer reference and your plan; we never see or store card numbers.</p>

        <h2>Who we send it to</h2>
        <p>Producing a video means sending content to third parties. These are all of them:</p>
        <ul>
          <li><strong>Anthropic</strong> — your project topic and your channel&rsquo;s video titles are sent so a script can be written.</li>
          <li><strong>ElevenLabs</strong> — script narration is sent to generate the voiceover.</li>
          <li><strong>fal.ai</strong> — scene prompts are sent to generate visuals.</li>
          <li><strong>Google / YouTube</strong> — only when you choose to publish, and only what you are publishing.</li>
          <li><strong>Stripe</strong> — payment processing.</li>
        </ul>
        <p>We do not sell your data, and we do not share it with anyone not on this list.</p>

        <h2>Google user data</h2>
        <p>ViralPilot&rsquo;s use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer noopener">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        <p>We request read access to your channel and video list so the guard can compare against your back catalogue, read access to analytics, and upload access so you can publish. <strong>Nothing is uploaded to your channel unless you explicitly choose to publish it.</strong></p>
        <p>Disconnecting a channel revokes the token with Google and deletes it from our database immediately.</p>

        <h2>Keeping it</h2>
        <p>Account and content data is kept while your account is open. Deleting your account deletes your projects, scripts, scenes, and channel connections. Anonymous operational logs may persist for up to 30 days.</p>

        <h2>Your rights</h2>
        <p>You can export or delete your data, disconnect any channel, and close your account at any time. If you are in the EU or UK you additionally have rights of access, rectification, erasure, restriction, portability and objection under the GDPR.</p>

        <h2>Contact</h2>
        <p>Privacy questions go to Quantum Synergy Solutions, the operator of ViralPilot. Add a monitored contact address here before this policy is published.</p>
      </div>
    </LegalShell>
  )
}

export function Terms() {
  return (
    <LegalShell title="Terms of service">
      <div className="lp-prose">
        <div className="lp-legal-notice">
          <strong>Draft for review.</strong> Have a lawyer read this before ViralPilot takes
          paying customers.
        </div>

        <h2>What ViralPilot does</h2>
        <p>ViralPilot helps you produce short-form video with AI assistance, and checks each video for originality and evidence of human authorship before it can be published to your channel.</p>

        <h2>Your responsibility for what you publish</h2>
        <p>You own what you create here, and you are responsible for it. The Originality Guard reduces the risk that a video looks mass-produced — it does not guarantee any outcome on YouTube or any other platform. <strong>We cannot promise your channel will not be actioned, and nobody who tells you otherwise is being straight with you.</strong> Review every video before publishing it.</p>
        <p>You agree not to use ViralPilot to produce content that infringes copyright, impersonates a real person, or breaks the rules of the platform you publish to.</p>

        <h2>The guard cannot be turned off</h2>
        <p>No plan, tier or setting disables the originality checks. Attempting to work around them — including via the API — is a breach of these terms.</p>

        <h2>AI-generated content</h2>
        <p>Videos use synthetic voice and generated visuals. ViralPilot applies YouTube&rsquo;s altered-content disclosure when publishing on your behalf. If you publish elsewhere, disclosure is yours to handle.</p>
        <p>Generated output is not guaranteed accurate. Check factual claims before publishing them.</p>

        <h2>Plans and billing</h2>
        <p>Plans are billed monthly through Stripe and include a set number of videos per month. Unused videos do not roll over. You can cancel at any time; access continues to the end of the paid period. We do not refund partial months unless the law requires it.</p>

        <h2>Availability</h2>
        <p>ViralPilot depends on third-party AI providers and on YouTube. We do not guarantee uninterrupted service, and features may change.</p>

        <h2>Ending your account</h2>
        <p>You can close your account at any time. We may suspend an account that breaches these terms, attempts to bypass the guard, or is used for illegal content.</p>

        <h2>Liability</h2>
        <p>ViralPilot is provided as is. To the extent the law allows, Quantum Synergy Solutions is not liable for lost revenue, lost monetisation, or platform decisions made about your channel.</p>

        <h2>Contact</h2>
        <p>Quantum Synergy Solutions operates ViralPilot. Add a monitored contact address here before these terms are published.</p>
      </div>
    </LegalShell>
  )
}
