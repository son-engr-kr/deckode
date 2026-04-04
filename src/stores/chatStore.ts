import { create } from "zustand";
import type { PlanResult, StylePreferences } from "@/ai/pipeline";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  stage?: string;
}

export interface PendingApproval {
  plan: PlanResult;
  resolve: (approved: boolean) => void;
}

export interface PendingStyleInquiry {
  resolve: (prefs: StylePreferences) => void;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isProcessing: boolean;
  currentStage: string | null;
  pendingApproval: PendingApproval | null;
  pendingStyleInquiry: PendingStyleInquiry | null;
  logs: string[];
  currentSessionId: string;
  sessions: ChatSession[];

  addMessage: (role: MessageRole, content: string, stage?: string) => void;
  setProcessing: (processing: boolean) => void;
  setCurrentStage: (stage: string | null) => void;
  setPendingApproval: (approval: PendingApproval | null) => void;
  setPendingStyleInquiry: (inquiry: PendingStyleInquiry | null) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
  clearMessages: () => void;
  newSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  loadProject: (projectName: string) => void;
}

let _messageCounter = 0;
let _currentProject: string | null = null;

function storageKey(project: string): string {
  return `deckode:chat:${project}`;
}

function loadSessions(project: string): ChatSession[] {
  const raw = localStorage.getItem(storageKey(project));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(project: string, sessions: ChatSession[]): void {
  localStorage.setItem(storageKey(project), JSON.stringify(sessions));
}

function createSession(): ChatSession {
  return {
    id: `session-${Date.now()}`,
    name: `Chat ${new Date().toLocaleString()}`,
    messages: [],
    createdAt: Date.now(),
  };
}

function persistState(state: { messages: ChatMessage[]; currentSessionId: string; sessions: ChatSession[] }): void {
  if (!_currentProject) return;
  const updated = state.sessions.map((s) =>
    s.id === state.currentSessionId ? { ...s, messages: state.messages } : s,
  );
  saveSessions(_currentProject, updated);
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isProcessing: false,
  currentStage: null,
  pendingApproval: null,
  pendingStyleInquiry: null,
  logs: [],
  currentSessionId: "",
  sessions: [],

  addMessage: (role, content, stage) => {
    set((state) => {
      const newMessages = [
        ...state.messages,
        {
          id: `msg-${++_messageCounter}`,
          role,
          content,
          timestamp: Date.now(),
          stage,
        },
      ];
      return { messages: newMessages };
    });
    // Persist after state update
    setTimeout(() => persistState(get()), 0);
  },

  setProcessing: (processing) => set({ isProcessing: processing }),

  setCurrentStage: (stage) => set({ currentStage: stage }),

  setPendingApproval: (approval) => set({ pendingApproval: approval }),

  setPendingStyleInquiry: (inquiry) => set({ pendingStyleInquiry: inquiry }),

  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log],
    })),

  clearLogs: () => set({ logs: [] }),

  clearMessages: () => {
    set({ messages: [], logs: [] });
    setTimeout(() => persistState(get()), 0);
  },

  newSession: () => {
    // Save current session first
    persistState(get());
    const session = createSession();
    set((state) => ({
      sessions: [...state.sessions, session],
      currentSessionId: session.id,
      messages: [],
      logs: [],
    }));
    setTimeout(() => persistState(get()), 0);
  },

  switchSession: (sessionId) => {
    // Save current session first
    persistState(get());
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (session) {
      _messageCounter = session.messages.length;
      set({
        currentSessionId: sessionId,
        messages: session.messages,
        logs: [],
      });
    }
  },

  deleteSession: (sessionId) => {
    const state = get();
    const remaining = state.sessions.filter((s) => s.id !== sessionId);
    if (sessionId === state.currentSessionId) {
      const next = remaining[remaining.length - 1] || createSession();
      if (remaining.length === 0) remaining.push(next);
      set({
        sessions: remaining,
        currentSessionId: next.id,
        messages: next.messages,
        logs: [],
      });
    } else {
      set({ sessions: remaining });
    }
    if (_currentProject) saveSessions(_currentProject, remaining);
  },

  loadProject: (projectName) => {
    _currentProject = projectName;
    const sessions = loadSessions(projectName);
    if (sessions.length === 0) {
      const session = createSession();
      sessions.push(session);
      saveSessions(projectName, sessions);
    }
    const current = sessions[sessions.length - 1]!;
    _messageCounter = current.messages.length;
    set({
      sessions,
      currentSessionId: current.id,
      messages: current.messages,
      logs: [],
    });
  },
}));
