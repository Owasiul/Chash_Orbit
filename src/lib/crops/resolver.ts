// src/lib/crops/resolver.ts
// Universal Crop Resolver: matches crops against the FAO EcoCrop database
// with an on-demand AI fallback (Gemini/NVIDIA) for any arbitrary crop.

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import {
  findFaoCrop,
  registerDynamicCrop,
  type FaoCropSpec,
} from '@/lib/crop-dataset';
import { getNvidiaModel, NVIDIA_CHAT_MODEL } from '@/lib/nvidia';

/**
 * Generate a deterministic agronomic fallback if AI inference is unavailable.
 */
function createAgronomicFallback(cropName: string): FaoCropSpec {
  const cleanName = cropName.trim();
  const lower = cleanName.toLowerCase();

  // Heuristic clues
  const isBeanOrPulse = lower.includes('bean') || lower.includes('gram') || lower.includes('pulse') || lower.includes('pea');
  const isGrain = lower.includes('grain') || lower.includes('millet') || lower.includes('grass') || lower.includes('rice') || lower.includes('wheat');
  const isFruit = lower.includes('berry') || lower.includes('fruit') || lower.includes('melon') || lower.includes('palm');

  return {
    id: lower.replace(/[^a-z0-9]+/g, '-'),
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    scientificName: `${cleanName} spp.`,
    aliases: [cleanName],
    family: isBeanOrPulse ? 'Fabaceae' : isGrain ? 'Poaceae' : 'General',
    category: isBeanOrPulse ? 'pulse' : isGrain ? 'cereal' : isFruit ? 'fruit' : 'vegetable',
    season: 'year_round',
    plantingMonths: [4, 5, 6, 10, 11],
    harvestMonths: [8, 9, 2, 3],
    growingDays: [90, 120],
    temp: { absMin: 8, optMin: 18, optMax: 30, absMax: 38 },
    water: { absMinMm: 350, optMinMm: 500, optMaxMm: 800, absMaxMm: 1300 },
    rootDepth: 'medium',
    nitrogenEffect: isBeanOrPulse ? 'fixer' : 'depleter',
    soilTextures: ['loamy', 'sandy', 'clay'],
    phRange: { min: 5.5, optMin: 6.0, optMax: 7.2, max: 8.0 },
    tolerances: {
      heat: 'medium',
      drought: 'medium',
      flood: 'low',
      salinity: 'medium',
    },
    baseIncome: 75,
    soilBenefits: isBeanOrPulse
      ? 'Leguminous nitrogen-fixing capability improves soil nutrient profile.'
      : 'Crop residues contribute to soil organic matter and soil health.',
    source: 'AI_INFERRED',
  };
}

/**
 * Resolves ANY crop name entered by a user.
 * 1. Checks FAO EcoCrop database (exact & aliases).
 * 2. If not found, calls AI model to generate FAO-standard agronomic parameters.
 * 3. Registers the crop in the dynamic registry for subsequent instant lookups.
 */
export async function resolveCrop(cropName: string): Promise<FaoCropSpec> {
  const existing = findFaoCrop(cropName);
  if (existing) {
    return existing;
  }

  // Attempt AI agronomic inference
  try {
    const hasGoogleKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
    const hasNvidiaKey = Boolean(process.env.NVIDIA_API_KEY?.trim());

    if (!hasGoogleKey && !hasNvidiaKey) {
      const fallback = createAgronomicFallback(cropName);
      registerDynamicCrop(fallback);
      return fallback;
    }

    const prompt = `You are a senior agricultural scientist and FAO EcoCrop database curator.
Generate the precise FAO EcoCrop ecological envelope for the crop named: "${cropName}".

Return a raw JSON object (and nothing else) adhering strictly to this schema:
{
  "name": "${cropName}",
  "scientificName": "Binomial Latin Name",
  "aliases": ["common alias 1", "alias 2"],
  "family": "Botanical Family (e.g. Fabaceae, Poaceae, Solanaceae)",
  "category": "cereal" | "pulse" | "oilseed" | "vegetable" | "fruit" | "tuber" | "fiber" | "cash_crop" | "cover_crop",
  "season": "kharif" | "rabi" | "summer" | "year_round",
  "plantingMonths": [typical calendar months 1-12 in Northern Hemisphere],
  "harvestMonths": [typical calendar months 1-12 in Northern Hemisphere],
  "growingDays": [minDays, maxDays],
  "temp": {
    "absMin": absolute survival min temp in C (integer or float),
    "optMin": lower optimal growth temp in C,
    "optMax": upper optimal growth temp in C,
    "absMax": upper heat kill temp in C
  },
  "water": {
    "absMinMm": seasonal min rainfall in mm,
    "optMinMm": lower optimal seasonal water in mm,
    "optMaxMm": upper optimal seasonal water in mm,
    "absMaxMm": seasonal waterlogging threshold in mm
  },
  "rootDepth": "shallow" | "medium" | "deep",
  "nitrogenEffect": "fixer" | "depleter" | "neutral",
  "soilTextures": ["sandy", "loamy", "clay"],
  "phRange": {
    "min": absolute min soil pH,
    "optMin": lower optimal pH,
    "optMax": upper optimal pH,
    "max": absolute max pH
  },
  "tolerances": {
    "heat": "low" | "medium" | "high",
    "drought": "low" | "medium" | "high",
    "flood": "low" | "medium" | "high",
    "salinity": "low" | "medium" | "high"
  },
  "baseIncome": relative economic profitability 1-100,
  "soilBenefits": "1 sentence describing agronomic benefits to soil structure, nitrogen, or biome"
}

Ensure strictly: absMin < optMin <= optMax < absMax for both temperature and water.`;

    let responseText = '';

    if (hasGoogleKey) {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
      });
      responseText = text;
    } else if (hasNvidiaKey) {
      const { text } = await generateText({
        model: getNvidiaModel(NVIDIA_CHAT_MODEL),
        prompt,
      });
      responseText = text;
    }

    // Clean JSON formatting if wrapped in code blocks
    const cleaned = responseText
      .replace(/^```json/m, '')
      .replace(/^```/m, '')
      .replace(/```$/m, '')
      .trim();

    const parsed = JSON.parse(cleaned) as FaoCropSpec;

    // Validate cardinal temperature & water parameters
    if (
      parsed.temp &&
      parsed.water &&
      parsed.temp.absMin < parsed.temp.optMin &&
      parsed.temp.optMin <= parsed.temp.optMax &&
      parsed.temp.optMax < parsed.temp.absMax &&
      parsed.water.absMinMm < parsed.water.optMinMm &&
      parsed.water.optMinMm <= parsed.water.optMaxMm &&
      parsed.water.optMaxMm < parsed.water.absMaxMm
    ) {
      const cropSpec: FaoCropSpec = {
        ...parsed,
        id: parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        source: 'AI_INFERRED',
      };
      registerDynamicCrop(cropSpec);
      return cropSpec;
    }
  } catch (err) {
    console.warn(`AI crop inference for "${cropName}" failed or timed out. Using agronomic fallback.`, err);
  }

  // Graceful fallback
  const fallback = createAgronomicFallback(cropName);
  registerDynamicCrop(fallback);
  return fallback;
}
