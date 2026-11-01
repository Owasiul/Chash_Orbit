import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getNvidiaModel, NVIDIA_CHAT_MODEL } from "@/lib/nvidia";

export async function POST(req: Request) {
  try {
    const { message, diagnosisContext } = await req.json();
    
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const { text: reply } = await generateText({
      model: getNvidiaModel(NVIDIA_CHAT_MODEL),
      system: `You are an expert agronomist assisting a farmer.
Context of current scan:
- Crop: ${diagnosisContext?.cropName || "Unknown"}
- Disease: ${diagnosisContext?.diseaseIdentified || "Healthy"}
- Severity: ${diagnosisContext?.severityLevel || "None"}
- Recommended Organic: ${diagnosisContext?.organicRemedy || "N/A"}
- Recommended Chemical: ${diagnosisContext?.chemicalTreatment || "N/A"}
Answer the farmer's question briefly, concisely, and practically with simple instructions.`,
      prompt: message,
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Analysis chat failed:", error);
    return NextResponse.json(
      { error: "Failed to process chat question" },
      { status: 500 },
    );
  }
}
