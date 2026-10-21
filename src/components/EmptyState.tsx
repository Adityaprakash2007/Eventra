import { CalendarX2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: "search" | "calendar";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Friendly empty state with a soft illustration and optional CTA. */
export default function EmptyState({
  icon = "calendar",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const Icon = icon === "search" ? SearchX : CalendarX2;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-primary">
          <Icon className="h-8 w-8" />
        </div>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
