import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNvidiaModel, NVIDIA_VISION_MODEL } from "@/lib/nvidia";

const responseSchema = z.object({
  cropName: z.string().describe("Name of the crop"),
  isHealthy: z.boolean().describe("Whether the crop is healthy"),
  diseaseIdentified: z.string().describe("Name of the disease or 'None'"),
  confidencePercentage: z.number().min(0).max(100).describe("Confidence score between 0 and 100"),
  severityLevel: z.enum(["LOW", "MODERATE", "CRITICAL", "NONE"]),
  symptoms: z.array(z.string()).describe("Observed physical symptoms on leaves, stems, or fruits"),
  organicRemedy: z.string().describe("Eco-friendly / organic solutions"),
  chemicalTreatment: z.string().optional().describe("Recommended pesticides/fungicides if severe"),
  preventativeTips: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, cropHint, notes } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const dataUriMatch = imageBase64.match(/^data:([^;]+);base64,/i);
    const imageData = imageBase64.replace(/^data:[^;]+;base64,/i, "");
    const mediaType = mimeType || dataUriMatch?.[1] || "image/jpeg";
    const prompt = `Analyze this crop image.
Context:
- Crop hint: ${cropHint || "Unknown"}
- Farmer's notes: ${notes || "None provided"}`;

// Generate structured diagnosis using vision model.
    const { output: diagnosis } = await generateText({
      model: getNvidiaModel(NVIDIA_VISION_MODEL),
      output: Output.object({ schema: responseSchema }),
      temperature: 0.2,
      system: `You are an expert Agronomist and Plant Pathologist for Chash Orbit.
Your goal is to inspect plant leaves/stems/crops from images and provide an accurate diagnosis, actionable remedies, and preventative measures. 
Ensure remedies are safe and practical for local farmers.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "file",
              data: Buffer.from(imageData, "base64"),
              mediaType,
            }
          ],
        },
      ],
    });

    // Return the structured diagnosis directly.
    return NextResponse.json({ success: true, data: diagnosis });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json(
      {
        error: "Failed to complete crop analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
