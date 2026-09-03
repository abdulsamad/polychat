import { ToolChoice, ToolSet } from 'ai';

import { availableModelsType, modelProviderType, supportedLanguagesType, profilesType } from './types';

export type SupportedModel = {
  name: availableModelsType;
  text: string;
  type: 'text' | 'image';
  disabled: boolean;
  isSpecial?: boolean;
  isExperimental?: boolean;
  provider: modelProviderType;
};

export const modelProviders = [
  'google',
  'openai',
  'anthropic',
  'mistral',
  'deepseek',
  'openrouter',
] as const;

export const modelProviderLabels: Record<SupportedModel['provider'], string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
};

export const supportedModels = [
  {
    name: 'gemini-3.7-flash',
    text: 'Gemini 3.7 Flash',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  {
    name: 'gemini-3.5-flash',
    text: 'Gemini 3.5 Flash',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  {
    name: 'gemini-3.5-flash-lite',
    text: 'Gemini 3.5 Flash Lite',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  { name: 'gpt-5.6-luna', text: 'GPT-5.6 Luna', type: 'text', disabled: false, provider: 'openai' },
  {
    name: 'gpt-5.6-terra',
    text: 'GPT-5.6 Terra',
    type: 'text',
    disabled: false,
    provider: 'openai',
  },
  // {
  //   name: 'deepseek-chat',
  //   text: 'DeepSeek Chat',
  //   type: 'text',
  //   isSpecial: true,
  //   disabled: false,
  //   provider: 'deepseek',
  // },
  // {
  //   name: 'deepseek-reasoner',
  //   text: 'DeepSeek Reasoner',
  //   type: 'text',
  //   isSpecial: true,
  //   disabled: false,
  //   provider: 'deepseek',
  // },
  {
    name: 'mistral-large-latest',
    text: 'Mistral Large',
    type: 'text',
    isSpecial: false,
    disabled: false,
    provider: 'mistral',
  },
  {
    name: 'mistral-medium-latest',
    text: 'Mistral Medium',
    type: 'text',
    isSpecial: false,
    disabled: false,
    provider: 'mistral',
  },
  {
    name: 'mistral-small-latest',
    text: 'Mistral Small',
    type: 'text',
    isSpecial: false,
    disabled: false,
    provider: 'mistral',
  },
  { name: 'dall-e-3', text: 'DALL-E 3', type: 'image', disabled: false, provider: 'openai' },
] as const satisfies readonly SupportedModel[];

export const defaultModel =
  'gemini-3.5-flash-lite' satisfies (typeof supportedModels)[number]['name'];

export const supportedTextModels: SupportedModel[] = supportedModels.filter(
  ({ type }) => type === 'text'
);

export const supportedImageModels: SupportedModel[] = supportedModels.filter(
  ({ type }) => type === 'image'
);

export const modelsForProvider = (
  models: readonly SupportedModel[],
  provider: SupportedModel['provider']
) => models.filter((model) => model.provider === provider);

export interface SystemPromptConfig {
  prompt: string;
  temperature?: number;
  seed?: number;
  tools?: ToolSet;
  toolChoice?: ToolChoice<ToolSet> | undefined;
  toolCallStreaming?: boolean;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export const getAssistantConfig = (
  profile: profilesType,
  language: supportedLanguagesType = 'en-US',
  customInstructions = ''
): SystemPromptConfig => {
  const basePromptString = `Respond in ${language} unless the user explicitly requests another language. Be accurate, concise, and transparent about uncertainty. Do not invent facts, sources, or capabilities.`;

  const defaultConfig: Omit<SystemPromptConfig, 'prompt'> = {
    temperature: 0.5,
    seed: undefined,
    tools: undefined,
    toolChoice: undefined,
    toolCallStreaming: false,
    maxTokens: 3000,
    topP: undefined,
    frequencyPenalty: undefined,
    presencePenalty: undefined,
    stopSequences: undefined,
  };

  switch (profile) {
    case 'developer':
      return {
        ...defaultConfig,
        prompt: `You are a practical software development assistant. Help with implementation, debugging, architecture, testing, and tradeoffs. Prefer maintainable, secure, idiomatic solutions and explain assumptions briefly. ${basePromptString}`,
        temperature: 0.5,
        frequencyPenalty: 0.2,
      };

    case 'snarky':
      return {
        ...defaultConfig,
        prompt: `You are Snarky Bot. Use restrained, dry humor when it helps, but never insult, demean, or obscure the answer. Give the correct, useful answer first or immediately after a brief joke. ${basePromptString}`,
        temperature: 0.7,
      };

    case 'grammar-corrector':
      return {
        ...defaultConfig,
        prompt: `Act as a careful ${language} editor and translator. Detect the input language, preserve meaning and tone, and return a natural corrected or translated version in ${language}. Return only the revised text unless the user asks for an explanation. ${basePromptString}`,
        temperature: 0.3,
      };

    case 'chef':
      return {
        ...defaultConfig,
        prompt: `Act as a practical cooking assistant. Suggest recipes with clear quantities, timings, substitutions, dietary considerations, cost, and food-safety notes when relevant. ${basePromptString}`,
        temperature: 0.7,
        topP: 0.9,
      };

    case 'doctor':
      return {
        ...defaultConfig,
        prompt: `Act as a health information guide, not a diagnosing clinician. Explain possible causes and evidence-informed next steps, ask for important context, avoid unsafe treatment claims, and identify urgent warning signs. ${basePromptString}`,
        temperature: 0.4,
        presencePenalty: 0.2,
      };

    case 'teacher':
      return {
        ...defaultConfig,
        prompt: `Act as a patient teacher. Explain concepts at the learner's level, use examples and step-by-step reasoning, define unfamiliar terms, and check understanding when useful. ${basePromptString}`,
        temperature: 0.5,
      };

    case 'historian':
      return {
        ...defaultConfig,
        prompt: `Act as a careful historian. Provide chronology, context, multiple perspectives, and a clear distinction between established evidence and interpretation. Never invent citations or historical details. ${basePromptString}`,
        temperature: 0.6,
        topP: 0.8,
      };

    case 'data-scientist':
      return {
        ...defaultConfig,
        prompt: `Act as a rigorous data science assistant. Clarify the question and data, recommend reproducible analysis and visualizations, show assumptions, validate results, and call out limitations. ${basePromptString}`,
        temperature: 0.4,
      };

    case 'legal-advisor':
      return {
        ...defaultConfig,
        prompt: `Act as a legal information guide, not a lawyer. Explain general principles, identify jurisdiction and deadline issues, distinguish facts from assumptions, and recommend qualified local counsel for consequential decisions. ${basePromptString}`,
        temperature: 0.3,
        presencePenalty: 0.3,
      };

    case 'custom':
      return {
        ...defaultConfig,
        prompt: `You are a helpful assistant guided by the user's saved preferences below. Follow them when they do not conflict with safety, accuracy, or the user's current request. ${basePromptString}\n\nUser's custom instructions:\n${customInstructions.trim()}`,
      };

    default:
      return {
        ...defaultConfig,
        prompt: `You are a helpful general-purpose assistant. Answer directly, organize complex responses clearly, and ask a focused clarifying question only when it is necessary. ${basePromptString}`,
        temperature: 0.5,
        maxTokens: 3000,
      };
  }
};

export const profiles = [
  {
    code: 'normal',
    text: 'Normal',
    selected: true,
    description: 'A normal and helpful assistant.',
    category: 'general',
    hints: [
      'What is the capital of France?',
      'Translate "Hello" to Spanish.',
      'Summarize the plot of Romeo and Juliet.',
      'What is the chemical symbol for water?',
    ],
  },
  {
    code: 'custom',
    text: 'Custom',
    selected: false,
    description: 'Follows your saved instructions from Settings.',
    category: 'personal',
    hints: [],
  },
  {
    code: 'developer',
    text: 'Developer',
    selected: false,
    description: 'Assists with coding, debugging, and software development best practices.',
    category: 'general',
    hints: [
      'How do I optimize my JavaScript code?',
      'What are the best practices for writing clean Python code?',
      'How do I debug a memory leak in a Node.js application?',
      'What’s the difference between REST and GraphQL?',
    ],
  },
  {
    code: 'snarky',
    text: 'Snarky Bot',
    selected: false,
    description: 'Snarky is sarcastic, funny and informative bot.',
    category: 'style',
    hints: [
      'How many pounds are in a kilogram?',
      'What does HTML stand for?',
      'When did the first airplane fly?',
      'Who invented the telephone?',
    ],
  },
  {
    code: 'grammar-corrector',
    text: 'Grammar Corrector',
    selected: false,
    description: 'Corrects grammar, improves sentence structure, and enhances vocabulary.',
    category: 'general',
    hints: [
      'Correct this sentence: "He go to school every day."',
      'Improve this sentence: "The food is very good."',
      'Fix the grammar: "She don’t like apples."',
      'Make this more elegant: "I want to go outside."',
    ],
  },
  {
    code: 'doctor',
    text: 'Doctor',
    selected: false,
    description: 'Provides medical advice, conventional treatments, and alternative remedies.',
    category: 'general',
    hints: [
      'What are the symptoms of the flu?',
      'How can I lower my blood pressure naturally?',
      'What should I do for a sprained ankle?',
      'Is it normal to have a headache every day?',
    ],
  },
  {
    code: 'teacher',
    text: 'Teacher',
    selected: false,
    description: 'Explains concepts in an easy-to-understand manner.',
    category: 'general',
    hints: [
      'Can you explain the Pythagorean theorem?',
      'How does photosynthesis work?',
      'What is Newton’s first law of motion?',
      'Why do we have seasons?',
    ],
  },
  {
    code: 'historian',
    text: 'Historian',
    selected: false,
    description: 'Analyzes and explains historical events and their impact.',
    category: 'general',
    hints: [
      'What caused World War I?',
      'Who was Julius Caesar?',
      'How did the Great Depression affect the world?',
      'What was the significance of the Renaissance?',
    ],
  },
  {
    code: 'chef',
    text: 'Chef',
    selected: false,
    description: 'Suggests healthy and easy-to-make recipes.',
    category: 'general',
    hints: [
      'What is a quick and healthy breakfast idea?',
      'How can I make a simple pasta dish?',
      'What are some good high-protein meals?',
      'Can you suggest a budget-friendly dinner recipe?',
    ],
  },
  {
    code: 'data-scientist',
    text: 'Data Scientist',
    selected: false,
    description: 'Provides data analysis techniques, visualization methods, and coding advice.',
    category: 'general',
    hints: [
      'How do I clean a messy dataset in Python?',
      'What is the best way to visualize time-series data?',
      'Can you explain the difference between supervised and unsupervised learning?',
      'How do I use Pandas to filter data?',
    ],
  },
  {
    code: 'legal-advisor',
    text: 'Legal Advisor',
    selected: false,
    description: 'Gives legal advice on various topics.',
    category: 'general',
    hints: [
      'What are my rights if I get arrested?',
      'How do I write a contract?',
      'What should I do if my landlord refuses to return my security deposit?',
      'Can I sue someone for defamation?',
    ],
  },
] as const;

export const profileGroups = Object.entries(
  profiles.reduce<Record<string, (typeof profiles)[number][]>>((groups, profile) => {
    (groups[profile.category] ||= []).push(profile);
    return groups;
  }, {})
);

type ImageSizeConfig = {
  default: string;
  options: readonly string[];
};

type ImageSizeOptions<T extends ImageSizeConfig> = T['options'][number];

export const imageSizes = (model: (typeof supportedImageModels)[0]['name']) => {
  if (model === 'dall-e-3') {
    const config = {
      default: '1024x1024',
      options: ['1024x1024', '1024x1792', '1792x1024'],
    } as const;

    return config;
  }

  const config = {
    default: '256x256',
    options: ['256x256', '512x512', '1024x1024'],
  } as const;

  return config;
};

export type ImageSizeType = ImageSizeOptions<ReturnType<typeof imageSizes>>;
