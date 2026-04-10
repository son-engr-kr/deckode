import { GoogleGenerativeAI, type Content, type Part, type Tool, type FunctionDeclaration, SchemaType } from "@google/generative-ai";

const STORAGE_KEY = "tekkal:gemini-api-key";
const LEGACY_STORAGE_KEY = "deckode:gemini-api-key";

export function getApiKey(): string | null {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current !== null) return current;
  // Back-compat: inherit from pre-rebrand key, then migrate forward
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }
  return null;
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const key = getApiKey();
  assert(key, "Gemini API key not set");
  if (!_client || (_client as unknown as { apiKey: string }).apiKey !== key) {
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

export type GeminiModel = string;

// -- Agent model configuration (persisted in localStorage) --

export const AVAILABLE_MODELS = [
  // GA
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  // Preview
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  // Deprecated
  "gemini-2.0-flash",
] as const;

export type AgentRole = "planner" | "generator" | "reviewer" | "writer";

export const DEFAULT_AGENT_MODELS: Record<AgentRole, string> = {
  planner: "gemini-2.5-flash",
  generator: "gemini-2.5-pro",
  reviewer: "gemini-2.5-flash",
  writer: "gemini-2.5-flash",
};

const MODELS_STORAGE_KEY = "tekkal:agent-models";
const LEGACY_MODELS_STORAGE_KEY = "deckode:agent-models";

export function getAgentModels(): Record<AgentRole, string> {
  let raw = localStorage.getItem(MODELS_STORAGE_KEY);
  if (raw === null) {
    raw = localStorage.getItem(LEGACY_MODELS_STORAGE_KEY);
    if (raw !== null) {
      localStorage.setItem(MODELS_STORAGE_KEY, raw);
      localStorage.removeItem(LEGACY_MODELS_STORAGE_KEY);
    }
  }
  if (!raw) return { ...DEFAULT_AGENT_MODELS };
  try {
    return { ...DEFAULT_AGENT_MODELS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AGENT_MODELS };
  }
}

export function setAgentModel(role: AgentRole, model: string): void {
  const current = getAgentModels();
  current[role] = model;
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(current));
  localStorage.removeItem(LEGACY_MODELS_STORAGE_KEY);
}

export function getModelForAgent(role: AgentRole): string {
  return getAgentModels()[role];
}

// -- Misc AI feature flags (persisted in localStorage) --

const AUTO_CAPTION_ON_UPLOAD_KEY = "tekkal:auto-caption-on-upload";
const LEGACY_AUTO_CAPTION_ON_UPLOAD_KEY = "deckode:auto-caption-on-upload";

/**
 * Whether to auto-generate an AI caption (aiSummary) for every image the
 * moment it is uploaded. Default false — captioning happens lazily on first
 * read instead, or on explicit generate_image_caption tool calls.
 */
export function getAutoCaptionOnUpload(): boolean {
  let raw = localStorage.getItem(AUTO_CAPTION_ON_UPLOAD_KEY);
  if (raw === null) {
    raw = localStorage.getItem(LEGACY_AUTO_CAPTION_ON_UPLOAD_KEY);
    if (raw !== null) {
      localStorage.setItem(AUTO_CAPTION_ON_UPLOAD_KEY, raw);
      localStorage.removeItem(LEGACY_AUTO_CAPTION_ON_UPLOAD_KEY);
    }
  }
  return raw === "true";
}

export function setAutoCaptionOnUpload(value: boolean): void {
  localStorage.setItem(AUTO_CAPTION_ON_UPLOAD_KEY, value ? "true" : "false");
  localStorage.removeItem(LEGACY_AUTO_CAPTION_ON_UPLOAD_KEY);
}

export interface ChatMessage {
  role: "user" | "model";
  parts: Part[];
}

export interface GeminiCallOptions {
  model: GeminiModel;
  systemInstruction: string;
  history?: Content[];
  tools?: Tool[];
  /**
   * Message body. A string sends a plain text message; a Part[] enables
   * multimodal input (text + inlineData/fileData parts) for image-aware calls.
   * The Google SDK accepts both forms in chat.sendMessage.
   */
  message: string | Part[];
  onStream?: (chunk: string) => void;
}

export interface GeminiResponse {
  text: string;
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

export async function callGemini(opts: GeminiCallOptions): Promise<GeminiResponse> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    tools: opts.tools,
  });

  const chat = model.startChat({
    history: opts.history ?? [],
  });

  const result = await chat.sendMessage(opts.message);
  const response = result.response;

  const functionCalls = response.functionCalls() ?? [];
  const text = response.text?.() ?? "";

  return {
    text,
    functionCalls: functionCalls.map((fc) => ({
      name: fc.name,
      args: fc.args as Record<string, unknown>,
    })),
  };
}

export async function callGeminiStream(opts: GeminiCallOptions): Promise<GeminiResponse> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    tools: opts.tools,
  });

  const chat = model.startChat({
    history: opts.history ?? [],
  });

  const result = await chat.sendMessageStream(opts.message);

  let fullText = "";
  const allFunctionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  for await (const chunk of result.stream) {
    const chunkText = chunk.text?.() ?? "";
    if (chunkText && opts.onStream) {
      opts.onStream(chunkText);
    }
    fullText += chunkText;

    const fcs = chunk.functionCalls?.() ?? [];
    for (const fc of fcs) {
      allFunctionCalls.push({
        name: fc.name,
        args: fc.args as Record<string, unknown>,
      });
    }
  }

  return { text: fullText, functionCalls: allFunctionCalls };
}

export function buildFunctionDeclarations(tools: DeckodeTool[]): Tool[] {
  const declarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  })) as unknown as FunctionDeclaration[];
  return [{ functionDeclarations: declarations }];
}

export interface DeckodeTool {
  name: string;
  description: string;
  parameters: {
    type: SchemaType;
    properties: Record<string, unknown>;
    required?: string[];
  };
}
