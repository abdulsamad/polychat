import { z } from 'zod';

import { languages } from './languages';
import { supportedImageModels, supportedModels, profiles } from './models';

const enumFrom = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

export const modelSchema = enumFrom(supportedModels.map(({ name }) => name));
export const imageModelSchema = enumFrom(supportedImageModels.map(({ name }) => name));
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
  quality: z.enum(['standard', 'hd']),
  style: z.enum(['vivid', 'natural']),
  size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ImageRequest = z.infer<typeof imageRequestSchema>;
