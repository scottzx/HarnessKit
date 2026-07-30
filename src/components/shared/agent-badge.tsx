interface AgentBadgeProps {
  name: string;
  size?: number;
  animated?: boolean;
  clicked?: boolean;
}

/**
 * 1agents-owned, text-only replacement for the upstream mascot artwork.
 * It intentionally uses no vendor logo, traced shape, raster asset, or
 * agent-specific illustration.
 */
export function AgentBadge({
  name,
  size = 48,
  animated = false,
  clicked = false,
}: AgentBadgeProps) {
  const label = name.trim().slice(0, 2).toUpperCase() || "AI";
  return (
    <span
      aria-hidden="true"
      data-animated={animated || undefined}
      data-clicked={clicked || undefined}
      className="inline-flex shrink-0 items-center justify-center rounded-[28%] border border-border bg-foreground font-bold tracking-[-0.08em] text-background transition-transform data-[animated=true]:group-hover:-translate-y-0.5 data-[clicked=true]:scale-95"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(7, Math.round(size * 0.3)),
      }}
      title={name}
    >
      {label}
    </span>
  );
}
