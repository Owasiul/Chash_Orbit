import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60; // Allow more time for LLM response

const explainSchema = z.object({
  executiveSummary: z.string().describe("A concise explanation of the field's current condition."),
  keyRisks: z.array(z.object({
    risk: z.string(),
    evidence: z.array(z.string()),
    dataStatus: z.enum(["LIVE", "CACHED", "DERIVED", "DEMO"]),
    action: z.string()
  })).describe("Relevant heat, drought, water, soil, or other risks supported by the actual analysis."),
  cropComparisons: z.array(z.object({
    crop: z.string(),
    rank: z.number(),
    score: z.number().optional(),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    evidence: z.array(z.string())
  })).describe("Compare the leading crop options using existing scores and available crop information."),
  rotationInsights: z.array(z.string()).describe("Explain the generated crop rotation plan and relevant crop-family considerations."),
  dataLimitations: z.array(z.string()).describe("Identify which inputs are live, cached, derived, or demo data."),
  nextSteps: z.array(z.string()).describe("Actionable checks and recommendations grounded in the available evidence.")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { analysis } = body;

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis data is required' }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: 'LLM API key is not configured' }, { status: 500 });
    }

    // Call LLM
    const { object } = await generateObject({
      model: google('gemini-3.5-flash-lite'),
      schema: explainSchema,
      prompt: `You are an expert agricultural advisor. Analyze the following deterministic field analysis results and explain them clearly to a farmer.

RULES:
- DO NOT invent, fabricate, or hallucinate any numbers, yield estimates, measurements, or scores.
- Only use the provided analysis data. If something is not in the data, do not guess it.
- Clearly distinguish between LIVE data (from NASA), CACHED data, DERIVED estimates, and DEMO data based on the source attributes in the data.
- Explain why the top crop was recommended based on its scores (climate, water, soil) and constraints.
- Do not present yourself as a certified agronomist; you are an AI assistant helping to interpret data.
- Be concise and professional.
- NEVER include the numerical score (e.g., 85.4) inside the executive summary, rotation insights, strengths, weaknesses, next steps, or ANY text fields. You may mention crop names and reasons, but keep numerical scores strictly out of the text. The UI will render the scores automatically.
- Use actual environmental values from the engine output (e.g., rainfall, temperature, ndvi) where relevant.

FIELD ANALYSIS DATA:
${JSON.stringify(analysis, null, 2)}
`
    });

    return NextResponse.json({ report: object });
  } catch (error: any) {
    console.error('Explanation generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate explanation', details: error.message }, { status: 500 });
  }
}
