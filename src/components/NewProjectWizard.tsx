import { useState } from "react";
import type { TemplateKind, WizardConfig, NewProjectConfig } from "@/utils/projectTemplates";
import { DARK_THEME, LIGHT_THEME } from "@/utils/projectTemplates";
import { assert } from "@/utils/assert";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: NewProjectConfig) => void;
  showNameField: boolean;
}

type Step = "template" | "wizard";

export function NewProjectWizard({ open, onClose, onConfirm, showNameField }: Props) {
  const [step, setStep] = useState<Step>("template");
  const [projectName, setProjectName] = useState("");

  // Wizard form state
  const [title, setTitle] = useState("Untitled Presentation");
  const [author, setAuthor] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [slideCount, setSlideCount] = useState(3);

  if (!open) return null;

  const reset = () => {
    setStep("template");
    setProjectName("");
    setTitle("Untitled Presentation");
    setAuthor("");
    setAspectRatio("16:9");
    setTheme("dark");
    setSlideCount(3);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTemplateSelect = (kind: TemplateKind) => {
    if (kind === "wizard") {
      setStep("wizard");
      return;
    }
    if (showNameField) {
      assert(projectName.trim().length > 0, "Project name is required");
      assert(/^[a-zA-Z0-9_-]+$/.test(projectName.trim()), "Project name: letters, digits, hyphens, underscores only");
    }
    // Blank and Example proceed directly
    onConfirm({ template: kind, name: showNameField ? projectName.trim() : undefined });
    reset();
  };

  const handleWizardSubmit = () => {
    assert(title.trim().length > 0, "Title is required");
    if (showNameField) {
      assert(projectName.trim().length > 0, "Project name is required");
      assert(/^[a-zA-Z0-9_-]+$/.test(projectName.trim()), "Project name: letters, digits, hyphens, underscores only");
    }
    const wizard: WizardConfig = {
      title: title.trim(),
      author: author.trim() || undefined,
      aspectRatio,
      theme,
      slideCount,
    };
    onConfirm({ template: "wizard", name: showNameField ? projectName.trim() : undefined, title: title.trim(), wizard });
    reset();
  };

  const darkBg = DARK_THEME.slide?.background?.color ?? "#0f172a";
  const lightBg = LIGHT_THEME.slide?.background?.color ?? "#ffffff";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "template" && (
          <>
            <h2 className="text-lg font-bold text-zinc-100 mb-1">New Project</h2>
            <p className="text-sm text-zinc-400 mb-5">Choose a template to start with.</p>

            {showNameField && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-zinc-400 mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="my-project (letters, digits, hyphens)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <TemplateCard
                title="Blank"
                description="Empty slide, dark theme"
                disabled={showNameField && !projectName.trim()}
                onClick={() => handleTemplateSelect("blank")}
              >
                <BlankPreview />
              </TemplateCard>

              <TemplateCard
                title="Example"
                description="7-slide demo deck"
                disabled={showNameField && !projectName.trim()}
                onClick={() => handleTemplateSelect("example")}
              >
                <ExamplePreview />
              </TemplateCard>

              <TemplateCard
                title="Wizard"
                description="Configure your deck"
                disabled={showNameField && !projectName.trim()}
                onClick={() => handleTemplateSelect("wizard")}
              >
                <WizardPreview />
              </TemplateCard>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "wizard" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setStep("template")}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-bold text-zinc-100">Configure Deck</h2>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Author</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Aspect Ratio</label>
                <div className="flex gap-2">
                  <ToggleButton active={aspectRatio === "16:9"} onClick={() => setAspectRatio("16:9")}>16:9</ToggleButton>
                  <ToggleButton active={aspectRatio === "4:3"} onClick={() => setAspectRatio("4:3")}>4:3</ToggleButton>
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Theme</label>
                <div className="flex gap-2">
                  <ToggleButton active={theme === "dark"} onClick={() => setTheme("dark")}>
                    <span className="inline-block w-3 h-3 rounded-full mr-1.5 border border-zinc-600" style={{ background: darkBg }} />
                    Dark
                  </ToggleButton>
                  <ToggleButton active={theme === "light"} onClick={() => setTheme("light")}>
                    <span className="inline-block w-3 h-3 rounded-full mr-1.5 border border-zinc-600" style={{ background: lightBg }} />
                    Light
                  </ToggleButton>
                </div>
              </div>

              {/* Slide Count */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Slides: {slideCount}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 px-0.5">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleWizardSubmit}
                disabled={!title.trim()}
                className="px-5 py-2 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
              >
                Create
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Expose projectName so parents can read it
NewProjectWizard.useProjectName = () => {
  // This is a pattern note — the actual name is passed via the parent's state.
  // See ProjectSelector for how projectName is extracted.
};

// ----- Sub-components -----

function TemplateCard({
  title,
  description,
  disabled,
  onClick,
  children,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-center group"
    >
      <div className="w-full aspect-video rounded bg-zinc-900 border border-zinc-700/50 overflow-hidden flex items-center justify-center group-hover:border-zinc-600 transition-colors">
        {children}
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-[11px] text-zinc-500">{description}</p>
      </div>
    </button>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

// ----- Template Preview Thumbnails -----

function BlankPreview() {
  return <div className="w-full h-full bg-white border border-zinc-200" />;
}

function ExamplePreview() {
  return (
    <div className="w-full h-full bg-white border border-zinc-200 flex flex-col items-center justify-center gap-1 p-2">
      <div className="w-10 h-1 bg-zinc-300 rounded" />
      <div className="w-16 h-0.5 bg-zinc-400 rounded" />
      <div className="flex gap-1 mt-1">
        <div className="w-3 h-3 rounded bg-zinc-200" />
        <div className="w-3 h-3 rounded bg-zinc-200" />
        <div className="w-3 h-3 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function WizardPreview() {
  return (
    <div className="w-full h-full bg-white border border-zinc-200 flex flex-col items-center justify-center gap-1 p-2">
      <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
      <div className="w-8 h-0.5 bg-zinc-400 rounded" />
    </div>
  );
}
