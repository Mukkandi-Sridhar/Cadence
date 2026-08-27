interface AiThinkingOverlayProps {
  title: string;
  subtitle?: string;
}

/**
 * Full-screen branded "AI is working" overlay — shown while transcribing
 * or scoring, so the wait reads as the college's own product doing
 * something deliberate, not a bare spinner.
 */
export function AiThinkingOverlay({ title, subtitle }: AiThinkingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="glass-card max-w-sm w-full p-8 flex flex-col items-center gap-5 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
          <span className="absolute inset-1 rounded-full bg-brand-500/10 animate-pulse" />
          <img
            src="/rgmcet-logo.jpg"
            alt="RGMCET crest"
            className="relative h-14 w-14 rounded-full object-contain shadow-md shadow-ink/10"
          />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink/60 mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
