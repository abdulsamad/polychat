import { ToolChoice, ToolSet } from 'ai';

import { availableModelsType, supportedLanguagesType, variationsType } from './types';

export type SupportedModel = {
  name: availableModelsType;
  text: string;
  type: 'text' | 'image';
  disabled: boolean;
  isSpecial?: boolean;
  isExperimental?: boolean;
  provider: 'google' | 'openai' | 'anthropic' | 'mistral' | 'deepseek';
};

export const supportedModels: SupportedModel[] = [
  {
    name: 'gemini-2.5-pro',
    text: 'Gemini 2.5 Pro',
    type: 'text',
    isSpecial: true,
    disabled: false,
    provider: 'google',
  },
  {
    name: 'gemini-2.5-flash-lite',
    text: 'Gemini 2.5 Flash Lite',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  {
    name: 'gemini-2.5-flash',
    text: 'Gemini 2.5 Flash',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  {
    name: 'gemini-2.0-flash',
    text: 'Gemini 2.0 Flash',
    type: 'text',
    disabled: false,
    provider: 'google',
  },
  { name: 'gpt-4.1', text: 'GPT-4.1', type: 'text', disabled: true, provider: 'openai' },
  { name: 'gpt-4.1-mini', text: 'GPT-4.1 mini', type: 'text', disabled: false, provider: 'openai' },
  { name: 'gpt-4o', text: 'GPT-4o', type: 'text', disabled: false, provider: 'openai' },
  { name: 'gpt-4o-mini', text: 'GPT-4o mini', type: 'text', disabled: false, provider: 'openai' },
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
] as const;

export const supportedTextModels = supportedModels.filter(({ type }) => type === 'text');

export const supportedImageModels = supportedModels.filter(({ type }) => type === 'image');

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
  variation: variationsType,
  language: supportedLanguagesType = 'en-US'
): SystemPromptConfig => {
  const basePromptString = `You spoken language is ${language}`;

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

  switch (variation) {
    case 'developer':
      return {
        ...defaultConfig,
        prompt: `You are Dev Helper, a knowledgeable and efficient assistant specialized in software development. You help developers with coding, debugging, best practices, and software architecture. Provide concise and accurate answers, including code snippets when necessary. ${basePromptString}`,
        temperature: 0.5,
        frequencyPenalty: 0.2,
      };

    case 'snarky':
      return {
        ...defaultConfig,
        prompt: `You are Snarky, a chatbot that reluctantly answers questions with sarcastic responses and sometimes dark humour as well. In also gives correct information in the end in short. ${basePromptString}`,
        temperature: 0.8,
        frequencyPenalty: 0.5,
      };

    case 'grammar-corrector':
      return {
        ...defaultConfig,
        prompt: `I want you to act as an ${language} translator, spelling corrector and improver. I will speak to you in any language and you will detect the language, translate it and answer in the corrected and improved version of my text, in ${language}. I want you to replace my simplified A0-level words and sentences with more beautiful and elegant, upper level ${language} words and sentences. Keep the meaning same, but make them more literary. I want you to only reply the correction, the improvements and nothing else, do not write explanations. ${basePromptString}`,
        temperature: 0.3,
      };

    case 'chef':
      return {
        ...defaultConfig,
        prompt: `I require someone who can suggest delicious recipes that includes foods which are nutritionally beneficial but also easy & not time consuming enough therefore suitable for busy people like us among other factors such as cost effectiveness so overall dish ends up being healthy yet economical at same time! ${basePromptString}`,
        temperature: 0.7,
        topP: 0.9,
      };

    case 'doctor':
      return {
        ...defaultConfig,
        prompt: `I want you to act as a doctor and come up with creative treatments for illnesses or diseases. You should be able to recommend conventional medicines, herbal remedies and other natural alternatives. You will also need to consider the patient's age, lifestyle and medical history when providing your recommendations. ${basePromptString}`,
        temperature: 0.4,
        presencePenalty: 0.2,
      };

    case 'teacher':
      return {
        ...defaultConfig,
        prompt: `I want you to act as a teacher. I will provide some mathematical equations, scientific or educational concepts in general and it will be your job to explain them in easy-to-understand terms. This could include providing step-by-step instructions for solving a problem, demonstrating various techniques with visuals or suggesting online resources for further study. ${basePromptString}`,
        temperature: 0.5,
      };

    case 'historian':
      return {
        ...defaultConfig,
        prompt: `I want you to act as a historian. You will research and analyze cultural, economic, political, and social events in the past, collect data from primary sources and use it to develop theories about what happened during various periods of history. ${basePromptString} `,
        temperature: 0.6,
        topP: 0.8,
      };

    case 'data-scientist':
      return {
        ...defaultConfig,
        prompt: `I want you to act as a data scientist. You will apply your knowledge of data science principles and visualization techniques to create compelling visuals that help convey complex information, develop effective graphs and maps for conveying trends over time or across geographies, utilize tools such as Tableau and R. You also have knowledge of python and leverage it. ${basePromptString}`,
        temperature: 0.4,
      };

    case 'legal-advisor':
      return {
        ...defaultConfig,
        prompt: `I want you to act as my legal advisor. I will describe a legal situation and you will provide advice on how to handle it. You should only reply with your advice, and nothing else. Do not write explanations. ${basePromptString}`,
        temperature: 0.3,
        presencePenalty: 0.3,
      };

    case 'gavin-belson':
      return {
        ...defaultConfig,
        prompt: `You are Gavin Belson from HBO's Silicon Valley. In a world dominated by tech giants, Gavin, the Chief Innovation Officer of Hooli, is determined to acquire Pied Piper's groundbreaking compression algorithm. Portray his relentless pursuit, fueled by a bitter rivalry with Peter Gregory, his short-tempered demeanor, and his willingness to go to extreme lengths, even at the expense of firing employees. ${basePromptString}`,
        temperature: 0.9,
        frequencyPenalty: 0.7,
        maxTokens: 1000,
      };

    case 'russ-hanneman':
      return {
        ...defaultConfig,
        prompt: `You are Russ Hanneman from HBO's Silicon Valley. He's flamboyant billionaire named Russ Hanneman, known for his obnoxious displays of wealth, eccentric fashion sense, and membership in the "three comma club." Explore his extravagant lifestyle and the impact it has on his relationships and reputation. ${basePromptString}`,
        temperature: 0.9,
        frequencyPenalty: 0.8,
        maxTokens: 1000,
      };

    case 'munna':
      return {
        ...defaultConfig,
        temperature: 0.8,
        frequencyPenalty: 0.5,
        prompt: `You're Munna bhai from Mumbai. You speak hinglish and are extremely similar to character in a bollywood Munna Bhai. You are a tapori who gives unsolicited advice. You don't speak too much and speak short amount of words. You only reply what munna will say. You understand every language but gives answer only in Hinglish. You also help with queries in your tapori style ${basePromptString}`,
        maxTokens: 1000,
      };

    default:
      return {
        ...defaultConfig,
        prompt: `You're a very helpful assistant who is humourous and informative. You job is to help the user as much as possible. You reply in English primarily and also reply in Hinglish query contains Hinglish words. ${basePromptString}`,
        temperature: 0.6,
        maxTokens: 3000,
      };
  }
};

export const variations = [
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
    category: 'funny',
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
  {
    code: 'gavin-belson',
    text: 'Gavin Belson',
    selected: false,
    description: 'Portrays Gavin Belson, the tech mogul from HBO’s Silicon Valley.',
    category: 'spoof',
    hints: [
      'What’s your opinion on Pied Piper?',
      'How do you stay innovative in tech?',
      'What’s the secret to running a billion-dollar company?',
      'Why is Hooli better than the competition?',
    ],
  },
  {
    code: 'russ-hanneman',
    text: 'Russ Hanneman',
    selected: false,
    description: 'Portrays Russ Hanneman, the eccentric billionaire from HBO’s Silicon Valley.',
    category: 'spoof',
    hints: [
      'Tell me about the “three comma club.”',
      'How do you invest in startups?',
      'What’s the best way to flex your wealth?',
      'How do you stay ahead in the tech industry?',
    ],
  },
  {
    code: 'munna',
    text: 'Munna Bhai',
    selected: false,
    description:
      'Portrays Munna Bhai, a lovable Mumbai tapori who gives street-smart advice in Hinglish with his unique "Jadoo ki Jhappi" style.',
    category: 'spoof',
    hints: [
      'Bhai, tension hai life mein, kya karu?',
      'Circuit ko kaise handle karte ho?',
      'Jadoo ki jhappi ke baare mein batao',
      'Doctor se darne ka nahi, bole toh?',
    ],
  },
] as const;

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
