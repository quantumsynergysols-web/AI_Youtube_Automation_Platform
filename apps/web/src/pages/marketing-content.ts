/**
 * Copy shared across the marketing pages.
 *
 * Kept in one place so the landing page and the deeper pages cannot drift into
 * describing the product differently — which is exactly what happens when the
 * same four guard checks are written out in three components.
 */

export const FIGURES = [
  { n: '4', label: 'checks every video clears before it can publish' },
  { n: '0', label: 'videos that publish without passing them' },
  { n: '90s', label: 'maximum length, identical on every plan' },
  { n: '3', label: 'free videos, no card required' },
]

export const STEPS = [
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

export const CHECKS = [
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

export const PLANS = [
  { name: 'Free', price: '$0', videos: '3 videos a month', channels: '1 channel', note: 'Enough to judge whether the output is worth publishing.' },
  { name: 'Starter', price: '$29', videos: '10 videos a month', channels: '1 channel', note: 'For a channel finding its publishing rhythm.' },
  { name: 'Creator', price: '$79', videos: '30 videos a month', channels: '1 channel', pick: true, note: 'Daily publishing on one channel.' },
  { name: 'Pro', price: '$199', videos: '90 videos a month', channels: '3 channels', note: 'Several channels, or a channel plus experiments.' },
  { name: 'Studio', price: '$399', videos: '200 videos a month', channels: '10 channels', note: 'A team running a portfolio of channels.' },
]

export const AUDIENCE = {
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

export const FAQ = [
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

/** Feature detail, for the Features page. */
export const FEATURES = [
  {
    label: 'Scripting',
    title: 'A structured script, not a wall of text',
    body: 'Hook, introduction, body beats and a call to action, each as its own scene with its own timing. The hook is separated out because it is the line that decides retention, and it is the line you are required to rewrite.',
    points: [
      'Written against your channel’s existing videos so it does not retread them',
      'Narration is clean spoken prose, ready for text-to-speech with no stage directions',
      'Never invents personal experience or statistics it cannot know',
    ],
  },
  {
    label: 'Art direction',
    title: 'One visual bible, obeyed by every scene',
    body: 'Image models have no memory between prompts, which is why generated video usually looks assembled rather than shot. ViralPilot writes the art direction once — subject, wardrobe, palette, lighting, lens, texture — and restates it in every scene prompt.',
    points: [
      'A self-contained image prompt per scene, not a shared style hint',
      'Describes one held moment rather than a sequence, which is what image models can actually render',
      'No on-screen text, because generated lettering comes out malformed',
    ],
  },
  {
    label: 'The human checkpoint',
    title: 'The part the product refuses to do for you',
    body: 'You rewrite the hook and write your own commentary. Time spent editing is recorded. None of it can be skipped, and saving the generated text untouched does not count.',
    points: [
      'Twenty-word minimum on commentary, so it cannot be satisfied by typing “yes”',
      'An unchanged hook is detected and reported honestly rather than shown as complete',
      'Editing time is measured only while the tab is focused, so the record holds up',
    ],
  },
  {
    label: 'Audit trail',
    title: 'Evidence, if a decision ever has to be appealed',
    body: 'Every check is stored against the video: what it was compared with, what the score was, which rule blocked it, what you changed and how long you spent. Kept because an appeal made months later needs a record made at the time.',
    points: [
      'The blocking reason is stored, not re-derived, so old records still explain themselves',
      'Editing a script clears any previous verdict, so a pass can never outlive the text it judged',
      'Nothing publishes without a current, passing check',
    ],
  },
]
