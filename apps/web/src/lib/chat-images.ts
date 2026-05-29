import type { ImageAttachment, MessageContentPart } from "@tinyclaw/core/contract";
import { parseDataUrl } from "@tinyclaw/core/message-content";
import type { FileUIPart } from "ai";

export function filePartsToImageAttachments(files: FileUIPart[]): ImageAttachment[] {
  const images: ImageAttachment[] = [];

  for (const file of files) {
    if (!file.mediaType?.startsWith("image/")) {
      continue;
    }

    const parsed = parseDataUrl(file.url);

    if (parsed) {
      images.push(parsed);
    }
  }

  return images;
}

export function userContentToDisplayImages(
  content: string | MessageContentPart[],
): Array<{ url: string; mediaType: string }> {
  if (typeof content === "string") {
    return [];
  }

  return content
    .filter((part): part is Extract<typeof part, { type: "image" }> => part.type === "image")
    .map((part) => ({
      mediaType: part.mediaType,
      url: `data:${part.mediaType};base64,${part.data}`,
    }));
}
