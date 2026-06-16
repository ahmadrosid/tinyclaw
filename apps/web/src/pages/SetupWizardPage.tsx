import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { SetupWizard } from "@/components/setup-wizard/SetupWizard";
import { SetupLayout } from "@/components/SetupLayout";
import { useAppContext } from "@/context/app-context";
import { pathForPage } from "@/lib/navigation";

export function SetupWizardPage() {
  const { health } = useAppContext();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Only redirect on the initial render (before mount) if the user is
  // already fully configured. Once the wizard mounts, allow the user to
  // finish all steps — even after providerConfigured becomes true on step 2.
  const isFullyConfigured = health?.userConfigured === true && health?.providerConfigured === true;
  if (!hasMounted && isFullyConfigured) {
    return <Navigate to={pathForPage("chat")} replace />;
  }

  return (
    <SetupLayout>
      <SetupWizard />
    </SetupLayout>
  );
}
