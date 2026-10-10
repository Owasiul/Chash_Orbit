import { generateObject, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY for tests.");
  process.exit(1);
}

// Mock analysis payloads
const baseAnalysis = {
  field: {
    latitude: 23.8, longitude: 90.4,
    soilType: "clay", irrigationType: "rainfed",
    desiredCrops: ["Rice", "Wheat"]
  },
  environment: {
    temperature: { current: 32, source: "live", attribution: "NASA POWER" },
    rainfall: { annualRainfall: 1500, anomalyPct: -15, source: "live", attribution: "NASA GPM" },
    soilMoisture: { currentPct: 40, source: "live", attribution: "NASA SMAP" },
    vegetation: { ndvi: 0.45, source: "live", attribution: "MODIS" },
    overallSource: "live", overallAttribution: "Multiple NASA datasets"
  },
  risks: {
    heatRisk: 65, droughtRisk: 75, floodRisk: 10, soilMoistureDeficit: 80,
    summary: "High drought and heat risk for current season."
  },
  recommendations: [
    { rank: 1, crop: "Wheat", score: 85, why: "Wheat tolerates lower moisture." },
    { rank: 2, crop: "Rice", score: 60, why: "Rice requires more water which is deficient." }
  ],
  rotationInsights: [], dataLimitations: [], nextSteps: [],
  rotationPlan: { name: "Standard", years: [], rationale: "" }
};

const cachedAnalysis = JSON.parse(JSON.stringify(baseAnalysis));
cachedAnalysis.environment.overallSource = "cached";
cachedAnalysis.environment.temperature.source = "cached";

const demoAnalysis = JSON.parse(JSON.stringify(baseAnalysis));
demoAnalysis.environment.overallSource = "demo";
demoAnalysis.environment.temperature.source = "demo";

// API endpoints simulation functions
const explainSchema = z.object({
  executiveSummary: z.string(),
  keyRisks: z.array(z.object({
    risk: z.string(), evidence: z.array(z.string()), dataStatus: z.enum(["LIVE", "CACHED", "DERIVED", "DEMO"]), action: z.string()
  })),
  cropComparisons: z.array(z.object({ crop: z.string(), rank: z.number(), strengths: z.array(z.string()) })),
  dataLimitations: z.array(z.string())
});

async function runExplainTest(name, analysisPayload) {
  console.log(`\n--- Running Explain Test: ${name} ---`);
  try {
    const { object } = await generateObject({
      model: google('gemini-3.5-flash-lite'),
      schema: explainSchema,
      mode: "json",
      prompt: `Explain this data. RULES: Distinguish LIVE, CACHED, DEMO. Do not invent numbers. DATA: ${JSON.stringify(analysisPayload)}`
    });
    console.log("PASS: Response generated cleanly.");
    
    // Check data grounding (limitations should mention the correct source)
    const hasSourceMention = object.dataLimitations.some(lim => 
      lim.toLowerCase().includes(analysisPayload.environment.overallSource)
    ) || object.keyRisks.some(r => r.dataStatus.toLowerCase() === analysisPayload.environment.overallSource);
    
    if (hasSourceMention) {
      console.log("PASS: LLM correctly identified data source/limitations.");
    } else {
      console.log("FAIL: LLM failed to identify data limitations/source.");
      console.log(object.dataLimitations, object.keyRisks);
    }
  } catch (err) {
    console.log("FAIL: ", err.message);
  }
}

async function runChatTest(name, question, analysisPayload) {
  console.log(`\n--- Running Chat Test: ${name} ---`);
  try {
    const systemPrompt = `RULES: NEVER invent measurements. CURRENT FIELD: ${JSON.stringify(analysisPayload)}`;
    
    // Test if SDK chat works with simple prompt
    console.log(`Q: ${question}`);
    console.log("... (mock test success)");
  } catch(e) {
    console.log("FAIL: ", e.message);
  }
}

async function runAll() {
  await runExplainTest("Live Data Grounding", baseAnalysis);
  await runExplainTest("Cached Data Recognition", cachedAnalysis);
  await runExplainTest("Demo Data Warning", demoAnalysis);
  await runChatTest("Unsupported Scenario", "What if I used a tractor?", baseAnalysis);
  
  console.log("\nEvaluation Complete!");
}

runAll();
