import { join } from "node:path";
import { getProfileSoulDir } from "../soul/resolve";

export const KNOWLEDGE_BASE_RELATIVE_DIR = join("data", "knowledge-base");
export const KNOWLEDGE_BASE_UPLOADS_DIR = "uploads";
export const KNOWLEDGE_BASE_EXTRACTED_DIR = "extracted";
export const KNOWLEDGE_BASE_MANIFEST_FILE = "manifest.json";

export function getKnowledgeBaseDir(orgId: string, profileId: string): string {
  return join(getProfileSoulDir(orgId, profileId), KNOWLEDGE_BASE_RELATIVE_DIR);
}

export function getKnowledgeBaseUploadsDir(orgId: string, profileId: string): string {
  return join(getKnowledgeBaseDir(orgId, profileId), KNOWLEDGE_BASE_UPLOADS_DIR);
}

export function getKnowledgeBaseExtractedDir(orgId: string, profileId: string): string {
  return join(getKnowledgeBaseDir(orgId, profileId), KNOWLEDGE_BASE_EXTRACTED_DIR);
}

export function getKnowledgeBaseManifestPath(orgId: string, profileId: string): string {
  return join(getKnowledgeBaseDir(orgId, profileId), KNOWLEDGE_BASE_MANIFEST_FILE);
}

export function getKnowledgeBaseUploadDir(
  orgId: string,
  profileId: string,
  documentId: string,
): string {
  return join(getKnowledgeBaseUploadsDir(orgId, profileId), documentId);
}

export function getKnowledgeBaseExtractedPath(
  orgId: string,
  profileId: string,
  documentId: string,
): string {
  return join(getKnowledgeBaseExtractedDir(orgId, profileId), `${documentId}.txt`);
}
