import { z } from 'zod';

import { languages } from './languages';
import { supportedModels, profiles } from './models';

const enumFrom = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

export const modelSchema = enumFrom(supportedModels.map(({ name }) => name));
// BYOK providers expose image model IDs at runtime, so this cannot be a
// build-time enum. The server still applies its curated-model check.
export const imageModelSchema = z.string().trim().min(1).max(200);
export const languageSchema = enumFrom(languages.map(({ code }) => code));
export const profileSchema = enumFrom(profiles.map(({ code }) => code));

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().max(32_000),
});

const MAX_CHAT_CONTENT_CHARS = 64_000;

export const chatRequestSchema = z
  .object({
    prompt: z.string().max(32_000).optional(),
    messages: z.array(messageSchema).max(100).optional(),
    language: languageSchema.optional(),
    profile: profileSchema.optional(),
    customInstructions: z.string().trim().max(4_000).optional(),
    modelConfig: z
      .object({
        maxTokens: z.number().int().min(1).max(128_000).optional(),
        temperature: z.number().min(0).max(2).optional(),
        topP: z.number().min(0).max(1).optional(),
        seed: z.number().int().optional(),
        frequencyPenalty: z.number().min(-2).max(2).optional(),
        presencePenalty: z.number().min(-2).max(2).optional(),
      })
      .optional(),
    model: modelSchema,
  })
  .refine(({ prompt, messages }) => Boolean(prompt?.trim() || messages?.length), {
    message: 'Prompt or messages not found',
  })
  .refine(
    ({ prompt, messages }) =>
      (prompt?.length || 0) + (messages?.reduce((total, message) => total + message.content.length, 0) || 0) <=
      MAX_CHAT_CONTENT_CHARS,
    { message: 'Chat content is too large.' }
  )
  .refine(
    ({ profile, customInstructions }) =>
      profile !== 'custom' || Boolean(customInstructions?.trim()),
    { message: 'Custom instructions are required for the Custom profile.' }
  );

export const imageRequestSchema = z.object({
  model: imageModelSchema,
  prompt: z.string().min(1).max(4_000),
  n: z.number().int().min(1).max(1).optional().default(1),
  quality: z.enum(['standard', 'hd']).optional().default('standard'),
  style: z.enum(['vivid', 'natural']).optional().default('vivid'),
  size: z.string().trim().min(1).max(32).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ImageRequest = z.infer<typeof imageRequestSchema>;
