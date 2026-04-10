import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore, type MessageContextRefs } from "@/stores/chatStore";
import { useDeckStore } from "@/stores/deckStore";
import { useContextBarStore } from "@/stores/contextBarStore";
import { useProjectRefStore } from "@/stores/projectRefStore";
import { runPipeline, type PipelineCallbacks, type PlanResult, type StylePreferences, type ContextBarSnapshot } from "@/ai/pipeline";
import { getApiKey, setApiKey, clearApiKey, getAgentModels, setAgentModel, AVAILABLE_MODELS, getAutoCaptionOnUpload, setAutoCaptionOnUpload, type AgentRole } from "@/ai/geminiClient";
import { ContextBar } from "./ContextBar";
import { AtMentionDropdown } from "./AtMentionDropdown";

interface LastSendParams {
  text: string;
  context: ContextBarSnapshot | undefined;
  contextRefs: MessageContextRefs | undefined;
}

export function AiChatPanel() {
  const [input, setInput] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionActive, setMentionActive] = useState(false);
  const messages = useChatStore((s) => s.messages);
  const isProcessing = useChatStore((s) => s.isProcessing);
  const currentStage = useChatStore((s) => s.currentStage);
  const pendingApproval = useChatStore((s) => s.pendingApproval);
  const pendingStyleInquiry = useChatStore((s) => s.pendingStyleInquiry);
  const logs = useChatStore((s) => s.logs);
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSendRef = useRef<LastSendParams | null>(null);
  const currentProject = useDeckStore((s) => s.currentProject);

  // Load chat sessions for current project
  useEffect(() => {
    if (currentProject) {
      useChatStore.getState().loadProject(currentProject);
    }
  }, [currentProject]);

  // API key state
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [agentModels, setAgentModels] = useState(getAgentModels);
  const [autoCaption, setAutoCaption] = useState(getAutoCaptionOnUpload);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, logs]);

  const handleSaveKey = () => {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim());
      setHasKey(true);
      setKeyInput("");
    }
  };

  /** Core send logic — used by both handleSend and retry. */
  const executeSend = useCallback(async (
    text: string,
    context: ContextBarSnapshot | undefined,
    contextRefs: MessageContextRefs | undefined,
    isRetry = false,
  ) => {
    const { addMessage, setProcessing, setCurrentStage, setPendingApproval, setPendingStyleInquiry, addLog, clearLogs } =
      useChatStore.getState();

    // Show "(retry)" label in chat UI but send original text to pipeline
    addMessage("user", isRetry ? `(retry) ${text}` : text, undefined, contextRefs);
    setProcessing(true);
    clearLogs();

    // Save for potential retry
    lastSendRef.current = { text, context, contextRefs };

    const callbacks: PipelineCallbacks = {
      onStageChange: (stage) => {
        setCurrentStage(stage);
      },
      onLog: (message) => {
        addLog(message);
        if (message.startsWith("[guide]")) {
          addMessage("assistant", message.replace("[guide] ", "📖 "));
        }
      },
      onPlanReady: (plan: PlanResult) => {
        return new Promise<boolean>((resolve) => {
          addMessage("assistant", formatPlan(plan), "plan");
          setPendingApproval({ plan, resolve });
        });
      },
      onStyleInquiry: () => {
        return new Promise<StylePreferences>((resolve) => {
          addMessage("assistant", "Before creating your deck, please choose your style preferences:", "plan");
          setPendingStyleInquiry({ resolve });
        });
      },
      onComplete: (summary) => {
        addMessage("assistant", summary);
        setProcessing(false);
        setCurrentStage(null);
      },
      onError: (error) => {
        addMessage("system", `Error: ${error}`);
        setProcessing(false);
        setCurrentStage(null);
      },
    };

    const recentMessages = useChatStore.getState().messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await runPipeline(text, callbacks, recentMessages, context);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");

    // Snapshot context bar
    const ctxState = useContextBarStore.getState();
    const context: ContextBarSnapshot | undefined =
      (ctxState.slideRef && !ctxState.slideRefDismissed) ||
      ctxState.elementRefs.length > 0 ||
      ctxState.projectRefs.length > 0
        ? {
            currentSlide: ctxState.slideRef && !ctxState.slideRefDismissed
              ? { slideId: ctxState.slideRef.slideId, slideIndex: ctxState.slideRef.slideIndex, title: ctxState.slideRef.slideTitle }
              : null,
            elements: ctxState.elementRefs.map((r) => ({
              elementId: r.elementId,
              slideId: r.slideId,
              type: r.type,
              label: r.label,
            })),
            projectNames: ctxState.projectRefs.map((r) => r.name),
          }
        : undefined;

    // Build contextRefs for message display
    const contextRefs: MessageContextRefs | undefined = context
      ? {
          ...(context.currentSlide ? { slide: context.currentSlide } : {}),
          ...(context.elements.length > 0 ? { elements: context.elements.map((e) => ({ elementId: e.elementId, type: e.type, label: e.label })) } : {}),
          ...(context.projectNames.length > 0 ? { projects: context.projectNames } : {}),
        }
      : undefined;

    // Clear element refs after send (project refs persist)
    useContextBarStore.getState().clearElementRefs();

    await executeSend(text, context, contextRefs);
  }, [input, isProcessing, executeSend]);

  const handleRetry = useCallback(async () => {
    if (!lastSendRef.current || isProcessing) return;
    const { text, context, contextRefs } = lastSendRef.current;
    await executeSend(text, context, contextRefs, true);
  }, [isProcessing, executeSend]);

  const handleApprove = (approved: boolean) => {
    const { pendingApproval, setPendingApproval, addMessage } = useChatStore.getState();
    if (pendingApproval) {
      addMessage("user", approved ? "Approved" : "Rejected");
      pendingApproval.resolve(approved);
      setPendingApproval(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // API key setup screen
  if (!hasKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-zinc-400">
        <div className="text-sm font-medium text-zinc-300">Gemini API Key</div>
        <p className="text-xs text-center">
          Enter your Gemini API key to enable AI features.
          <br />
          Stored in browser localStorage only.
        </p>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
          placeholder="AIza..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSaveKey}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
        >
          Save Key
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">AI</span>
          {currentStage && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">
              {stageLabel(currentStage)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => useChatStore.getState().newSession()}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            title="New session"
          >
            +
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`text-[10px] transition-colors ${showSettings ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Settings
          </button>
          <button
            onClick={() => useChatStore.getState().clearMessages()}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Session tabs */}
      {sessions.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800 overflow-x-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => useChatStore.getState().switchSession(s.id)}
              className={`text-[9px] px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                s.id === currentSessionId
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s.messages.length > 0 ? s.messages[0]!.content.slice(0, 20) + (s.messages[0]!.content.length > 20 ? "..." : "") : "New"}
            </button>
          ))}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-zinc-800 px-3 py-2 space-y-2 bg-zinc-900/50">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Agent Models</div>
          {(["planner", "generator", "reviewer", "writer"] as AgentRole[]).map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-16 capitalize">{role}</span>
              <select
                value={agentModels[role]}
                onChange={(e) => {
                  setAgentModel(role, e.target.value);
                  setAgentModels(getAgentModels());
                }}
                className="flex-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-zinc-400 w-16">API Key</span>
            <button
              onClick={() => { clearApiKey(); setHasKey(false); }}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Reset Key
            </button>
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer" title="When enabled, uploading an image triggers an immediate Gemini multimodal call to generate an aiSummary. When disabled (default), captions are generated lazily on first AI read.">
            <input
              type="checkbox"
              checked={autoCaption}
              onChange={(e) => {
                setAutoCaptionOnUpload(e.target.checked);
                setAutoCaption(e.target.checked);
              }}
              className="accent-blue-500"
            />
            <span className="text-[10px] text-zinc-400">Auto-caption images on upload</span>
          </label>
          <ReferenceProjectsSection />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-zinc-500 text-center mt-8">
            Ask me to create slides, modify content, write speaker notes, or review your deck.
          </div>
        )}
        {messages.map((msg, msgIdx) => (
          <div
            key={msg.id}
            className={`text-xs leading-relaxed ${
              msg.role === "user"
                ? "text-zinc-200 bg-zinc-800 rounded-lg px-3 py-2 ml-8"
                : msg.role === "system"
                  ? "text-red-400 bg-red-950/30 rounded-lg px-3 py-2"
                  : "text-zinc-300 bg-zinc-900 rounded-lg px-3 py-2 mr-8"
            }`}
          >
            {/* Context refs display */}
            {msg.contextRefs && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {msg.contextRefs.slide && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-700/50 text-[9px] text-zinc-400">
                    📄 Slide {msg.contextRefs.slide.slideIndex + 1}
                  </span>
                )}
                {msg.contextRefs.elements?.map((e) => (
                  <span key={e.elementId} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-700/50 text-[9px] text-zinc-400">
                    ◇ {e.type}: {e.label}
                  </span>
                ))}
                {msg.contextRefs.projects?.map((p) => (
                  <span key={p} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-700/50 text-[9px] text-zinc-400">
                    📁 @{p}
                  </span>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap">{msg.content.replace(/\\n/g, "\n")}</div>
            {msg.stage && (
              <div className="text-[10px] text-zinc-500 mt-1">
                Stage: {stageLabel(msg.stage)}
              </div>
            )}
            {/* Retry button on error messages */}
            {msg.role === "system" && msg.content.startsWith("Error:") && msgIdx === messages.length - 1 && !isProcessing && (
              <button
                onClick={handleRetry}
                className="mt-1.5 px-2 py-0.5 text-[10px] bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        ))}

        {/* Approval gate */}
        {pendingApproval && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleApprove(true)}
              className="flex-1 text-xs py-1.5 bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleApprove(false)}
              className="flex-1 text-xs py-1.5 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
            >
              Reject
            </button>
          </div>
        )}

        {/* Style preference form */}
        {pendingStyleInquiry && <StylePreferenceForm />}

        {/* Processing indicator */}
        {isProcessing && !pendingApproval && !pendingStyleInquiry && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-zinc-300">
                {currentStage ? stageLabel(currentStage) : "Processing"}
              </span>
              <span className="text-[10px] text-zinc-600 ml-auto">{logs.length} ops</span>
            </div>
            {logs.length > 0 && (
              <div className="text-[10px] text-zinc-500 font-mono leading-relaxed break-all">
                {logs[logs.length - 1]}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context bar + Input */}
      <ContextBar />
      <div className="border-t border-zinc-800 px-3 py-2">
        <div className="relative flex gap-2">
          {mentionActive && (
            <AtMentionDropdown
              inputValue={input}
              cursorPosition={cursorPos}
              onSelect={() => {
                // Remove @query from input
                const before = input.slice(0, cursorPos);
                const atIdx = before.lastIndexOf("@");
                const after = input.slice(cursorPos);
                setInput(before.slice(0, atIdx) + after);
                setCursorPos(atIdx);
                setMentionActive(false);
              }}
              onDismiss={() => setMentionActive(false)}
            />
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              const pos = e.target.selectionStart ?? val.length;
              setInput(val);
              setCursorPos(pos);
              // Detect @ mention
              const textBefore = val.slice(0, pos);
              const atIdx = textBefore.lastIndexOf("@");
              const active =
                atIdx !== -1 &&
                (atIdx === 0 || /\s/.test(textBefore[atIdx - 1]!)) &&
                !textBefore.slice(atIdx + 1).includes(" ");
              setMentionActive(active);
              // Auto-resize
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              // Let AtMentionDropdown handle keys when active
              if (mentionActive && ["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) return;
              if (mentionActive && e.key === "Enter") return;
              handleKeyDown(e);
            }}
            placeholder="Ask AI... (@ to reference a project)"
            disabled={isProcessing}
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
            style={{ minHeight: 28, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case "plan": return "Planning";
    case "generate": return "Generating";
    case "review": return "Reviewing";
    case "notes": return "Writing Notes";
    default: return stage;
  }
}

function StylePreferenceForm() {
  const [theme, setTheme] = useState<"dark" | "light" | "custom">("light");
  const [animations, setAnimations] = useState<"rich" | "minimal" | "none">("rich");
  const [highlightBoxes, setHighlightBoxes] = useState(true);
  const [notesTone, setNotesTone] = useState<"narrative" | "telegraphic" | "scripted">("narrative");

  const handleSubmit = () => {
    const { pendingStyleInquiry, setPendingStyleInquiry, addMessage } = useChatStore.getState();
    if (!pendingStyleInquiry) return;
    const prefs: StylePreferences = { theme, animations, highlightBoxes, notesTone };
    const summary = `Theme: ${theme} | Animations: ${animations} | Highlights: ${highlightBoxes ? "yes" : "no"} | Notes: ${notesTone}`;
    addMessage("user", summary);
    pendingStyleInquiry.resolve(prefs);
    setPendingStyleInquiry(null);
  };

  const radioGroup = (
    label: string,
    options: { value: string; label: string; desc?: string }[],
    current: string,
    onChange: (v: any) => void,
  ) => (
    <div className="space-y-1">
      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              current === opt.value
                ? "border-blue-500 bg-blue-600/20 text-blue-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500"
            }`}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 space-y-2.5 mt-2">
      {radioGroup("Theme", [
        { value: "dark", label: "Dark", desc: "Dark background (#0f172a), light text" },
        { value: "light", label: "Light", desc: "White background, dark text" },
        { value: "custom", label: "Custom", desc: "Custom color scheme" },
      ], theme, setTheme)}

      {radioGroup("Animations", [
        { value: "rich", label: "Rich", desc: "Per-element onClick fade-in for step-by-step reveal" },
        { value: "minimal", label: "Minimal", desc: "Only onEnter fade for whole-slide transitions" },
        { value: "none", label: "None", desc: "No animations" },
      ], animations, setAnimations)}

      {radioGroup("Highlight Boxes", [
        { value: "yes", label: "Yes", desc: "Red-stroke emphasis rectangles with onClick fadeIn" },
        { value: "no", label: "No", desc: "No highlight boxes" },
      ], highlightBoxes ? "yes" : "no", (v: string) => setHighlightBoxes(v === "yes"))}

      {radioGroup("Notes Tone", [
        { value: "narrative", label: "Narrative", desc: "Conversational academic tone" },
        { value: "telegraphic", label: "Telegraphic", desc: "Keyword reminders only" },
        { value: "scripted", label: "Scripted", desc: "Full manuscript to read verbatim" },
      ], notesTone, setNotesTone)}

      <button
        onClick={handleSubmit}
        className="w-full text-xs py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors mt-1"
      >
        Apply Preferences
      </button>
    </div>
  );
}

function ReferenceProjectsSection() {
  const registeredProjects = useProjectRefStore((s) => s.registeredProjects);
  const registerProject = useProjectRefStore((s) => s.registerProject);
  const unregisterProject = useProjectRefStore((s) => s.unregisterProject);

  // Load registered projects on mount
  useEffect(() => {
    useProjectRefStore.getState().loadRegistered();
  }, []);

  return (
    <div className="pt-2 border-t border-zinc-800 mt-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Reference Projects</div>
      {registeredProjects.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {registeredProjects.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-300 truncate">📁 {p.name}</span>
              <button
                onClick={() => unregisterProject(p.name)}
                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => registerProject()}
        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        + Add Reference Folder
      </button>
    </div>
  );
}

function formatPlan(plan: PlanResult): string {
  if (plan.intent === "modify") {
    return `**Plan: Modify Deck**\n\n${plan.actions?.map((a, i) => `${i + 1}. ${a}`).join("\n") ?? plan.reasoning}\n\nApprove to proceed?`;
  }
  if (!plan.plan) return plan.reasoning;

  const lines = [
    `**Plan: ${plan.plan.topic}**`,
    `Audience: ${plan.plan.audience} | Slides: ${plan.plan.slideCount}`,
    "",
    ...plan.plan.slides.map(
      (s, i) =>
        `${i + 1}. **${s.title}** (${s.type})\n   ${s.keyPoints.join(" · ")}`,
    ),
    "",
    "Approve to generate?",
  ];
  return lines.join("\n");
}
