import { useContextBarStore } from "@/stores/contextBarStore";

function Chip({ icon, label, onRemove }: { icon: string; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 max-w-[200px]">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      <button
        onClick={onRemove}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 ml-0.5 leading-none"
        title="Remove"
      >
        ×
      </button>
    </span>
  );
}

export function ContextBar() {
  const slideRef = useContextBarStore((s) => s.slideRef);
  const slideRefDismissed = useContextBarStore((s) => s.slideRefDismissed);
  const elementRefs = useContextBarStore((s) => s.elementRefs);
  const projectRefs = useContextBarStore((s) => s.projectRefs);
  const dismissSlideRef = useContextBarStore((s) => s.dismissSlideRef);
  const removeElementRef = useContextBarStore((s) => s.removeElementRef);
  const removeProjectRef = useContextBarStore((s) => s.removeProjectRef);

  const hasContent =
    (slideRef && !slideRefDismissed) ||
    elementRefs.length > 0 ||
    projectRefs.length > 0;

  if (!hasContent) return null;

  return (
    <div className="flex flex-wrap gap-1 px-3 py-1.5 border-t border-zinc-800">
      {slideRef && !slideRefDismissed && (
        <Chip
          icon="📄"
          label={`Slide ${slideRef.slideIndex + 1}: ${slideRef.slideTitle}`}
          onRemove={dismissSlideRef}
        />
      )}
      {elementRefs.map((ref) => (
        <Chip
          key={ref.elementId}
          icon="◇"
          label={`${ref.type}: ${ref.label}`}
          onRemove={() => removeElementRef(ref.elementId)}
        />
      ))}
      {projectRefs.map((ref) => (
        <Chip
          key={ref.name}
          icon="📁"
          label={`@${ref.name}`}
          onRemove={() => removeProjectRef(ref.name)}
        />
      ))}
    </div>
  );
}
