/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    ALLOWED_ORIGINS: string;
    CLERK_ISSUER_BASE_URL: string;
    CLERK_AUTHORIZED_PARTIES: string;
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    MISTRAL_API_KEY: string;
    DEEPSEEK_API_KEY: string;
    OPENROUTER_API_KEY: string;
  }
}
