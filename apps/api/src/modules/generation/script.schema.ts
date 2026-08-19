import * as z from 'zod/v4'

/**
 * The shape the scriptwriter must return (FR-4).
 *
 * Built on zod/v4 rather than the v3 import used for request validation
 * elsewhere: structured outputs go through `betaZodOutputFormat`, which needs
 * v4's `toJSONSchema`. zod 3.25 ships both, so the two coexist without forcing
 * a migration of every route in the API.
 *
 * Deliberately free of length and range constraints. Structured outputs cannot
 * express them, so the SDK would strip them from the schema sent to the model
 * and then enforce them client-side — turning a mildly-too-short hook into a
 * thrown exception instead of a draft the creator can edit. Ranges are checked
 * in the service, where a miss can be reported rather than raised.
 */

export const SCENE_ROLES = ['HOOK', 'INTRODUCTION', 'BODY', 'CALL_TO_ACTION'] as const
export type SceneRole = (typeof SCENE_ROLES)[number]

export const SceneDraftSchema = z.object({
  role: z
    .enum(SCENE_ROLES)
    .describe(
      'Which part of the video this scene is. Exactly one HOOK, first. Exactly one CALL_TO_ACTION, last.',
    ),
  narration: z
    .string()
    .describe(
      'Exactly what the voiceover says for this scene. Spoken prose only — no stage directions, ' +
        'no speaker labels, no bracketed notes, no markdown. It is fed verbatim to a text-to-speech engine.',
    ),
  visualPrompt: z
    .string()
    .describe(
      'A self-contained image prompt for this scene. The image model has no memory of the other ' +
        'scenes, so restate every detail from the art direction that must stay consistent — ' +
        'subject, wardrobe, palette, lens, lighting. Describe one moment, not a sequence.',
    ),
  estimatedSeconds: z
    .number()
    .describe('How long the narration takes to speak aloud at a natural pace, in seconds.'),
})

export const ScriptDraftSchema = z.object({
  title: z
    .string()
    .describe('A title for the finished video. Plain text, no hashtags, no surrounding quotes.'),
  artDirection: z
    .string()
    .describe(
      'The art-direction bible: one paragraph fixing the visual identity for the whole video — ' +
        'subject and wardrobe, colour palette, lighting, lens and framing, texture, mood. ' +
        'Written once and obeyed by every scene, because per-scene improvisation is what makes ' +
        'a generated video look like it was assembled by a machine.',
    ),
  scenes: z.array(SceneDraftSchema).describe('The video in order, start to finish.'),
})

export type SceneDraft = z.infer<typeof SceneDraftSchema>
export type ScriptDraft = z.infer<typeof ScriptDraftSchema>
