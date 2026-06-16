import { UserContextSettings } from "@/components/UserContextCard";
import { Button } from "@/components/ui/button";

interface SetupStepUserContextProps {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function SetupStepUserContext({ onNext, onSkip, onBack }: SetupStepUserContextProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card">
        <UserContextSettings onSaveSuccess={onNext} autoInit={true} />
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          Back
        </Button>

        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          onClick={onSkip}
        >
          Set up later
        </button>
      </div>
    </div>
  );
}