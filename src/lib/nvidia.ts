import { createOpenAI } from "@ai-sdk/openai";

// Read once at module load. Empty string means "not configured";
// getNvidiaModel() validates lazily so `next build` never fails on missing env.
export const NVIDIA_CHAT_MODEL =
  process.env.NVIDIA_CHAT_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b";
export const NVIDIA_VISION_MODEL = process.env.NVIDIA_VISION_MODEL?.trim() || "nvidia/nemotron-3.5-super-vl-120b-a12b";

export function getNvidiaModel(modelId: string) {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not configured. Add it to .env.local and restart the dev server."
    );
  }

  if (!modelId) {
    throw new Error(
      "NVIDIA model id is empty. Set NVIDIA_CHAT_MODEL / NVIDIA_VISION_MODEL in .env.local and restart the dev server."
    );
  }

  const nvidia = createOpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  
  return nvidia.chat(modelId);
}