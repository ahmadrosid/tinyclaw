import { ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProviderSetupForm } from "@/components/ProviderSetupForm";
import { SetupLayout } from "@/components/SetupLayout";
import { TelegramSettingsCard } from "@/components/TelegramSettingsCard";
import { Spinner } from "@/components/ui/spinner";
import { useAppContext } from "@/context/app-context";
import { useModelsQuery } from "@/hooks/use-app-queries";
import { pathForPage } from "@/lib/navigation";

export function SetupWizardPage() {
  const navigate = useNavigate();
  const { health } = useAppContext();
  const { isLoading: catalogLoading } = useModelsQuery();
  const providerConfigured = health?.providerConfigured === true;

  const goToChat = useCallback(() => {
    navigate(pathForPage("chat"), { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (providerConfigured) {
      goToChat();
    }
  }, [providerConfigured, goToChat]);

  if (catalogLoading || providerConfigured) {
    return (
      <SetupLayout>
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      </SetupLayout>
    );
  }

  return (
    <SetupLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Welcome to TinyClaw</h1>
          <p className="text-sm text-muted-foreground">
            Connect your LLM provider to enable chat. Credentials are saved on the server.
          </p>
        </div>

        <ProviderSetupForm
          submitLabel="Continue"
          showHeading={false}
          onSuccess={goToChat}
        />

        <details className="group border-t border-border pt-6">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1 font-medium text-foreground transition-colors marker:content-none hover:text-primary [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-foreground"
              aria-hidden="true"
            />
            <span>Telegram</span>
            <span className="text-sm font-normal text-muted-foreground group-open:hidden">
              Optional — set up later in Settings
            </span>
          </summary>
          <div className="mt-4">
            <TelegramSettingsCard embedded />
          </div>
        </details>
      </div>
    </SetupLayout>
  );
}
