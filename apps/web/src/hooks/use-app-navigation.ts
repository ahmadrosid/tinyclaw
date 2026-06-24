import { useNavigate } from "react-router-dom";
import {
  buildChatBasePath,
  buildChatPath,
  type RequestedChatSession,
  MAX_URL_CHAT_DRAFT_LENGTH,
  storeChatDraft,
} from "@/lib/chat-history";
import { pathForPage, toolPlaygroundPath, type PageId } from "@/lib/navigation";

export function useAppNavigation() {
  const navigate = useNavigate();

  return {
    navigateToPage(pageId: PageId) {
      navigate(pathForPage(pageId));
    },
    navigateToChat(session: RequestedChatSession) {
      navigate(buildChatPath(session.profileId, session.sessionId));
    },
    navigateToToolPlayground(toolId: string) {
      navigate(toolPlaygroundPath(toolId));
    },
    navigateToNewChat(profileId?: string | null, options?: { draft?: string }) {
      const params = new URLSearchParams({ new: "1", _: String(Date.now()) });
      if (profileId) {
        params.set("profile", profileId);
      }

      const draft = options?.draft?.trim();
      if (draft) {
        if (draft.length <= MAX_URL_CHAT_DRAFT_LENGTH) {
          params.set("draft", draft);
        } else {
          params.set("draftKey", storeChatDraft(draft));
        }
      }

      navigate(`${buildChatBasePath()}?${params.toString()}`);
    },
  };
}
