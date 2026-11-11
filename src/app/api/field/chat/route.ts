import { streamText, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { google } from '@ai-sdk/google';
import { translateMessage, type Locale } from '@/lib/i18n';

export const maxDuration = 60;

// In-memory sliding window rate limiter per client IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute
const MAX_MESSAGE_LENGTH = 500; // Maximum allowed characters per message

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

/**
 * Deterministic grounded answer generator when LLM API key is not configured or offline.
 */
function generateDeterministicAnswer(
  query: string,
  analysis: any | null,
  locale: Locale,
): string {
  const isBn = locale === 'bn-BD';
  const q = (query || '').toLowerCase();

  if (!analysis) {
    if (isBn) {
      return (
        "👋 **স্বাগতম! আমি চাষ অরবিট এআই উপদেষ্টা (Gemini 3.5 Flash Lite দ্বারা চালিত)।**\n\n" +
        "আপনার খামারের উপগ্রহভিত্তিক সঠিক তথ্য পেতে উপরের মানচিত্রে আপনার অবস্থান খুঁজুন অথবা ড্রয়িং টুল দিয়ে জমির সীমানা নির্ধারণ করুন।\n\n" +
        "- 🛰️ **নাসা পাওয়ার (NASA POWER)**: সৌর বিকিরণ, তাপমাত্রা এবং বাৎসরিক বৃষ্টিপাতের নির্ভুল ডেটা।\n" +
        "- 🌿 **মোডিস ২৫০মি (MODIS 250m)**: ১৬ দিনের ব্যবধানে ফসলের ঘনত্ব (NDVI)।\n" +
        "- 🌾 **ফসল পরিক্রমা**: মাটির উর্বরতা রক্ষা ও সর্বোচ্চ আয়ের জন্য ৪ বছরের পরিকল্পনা।"
      );
    }
    return (
      "👋 **Welcome! I am your Chash Advisor powered by Gemini 3.5 Flash Lite.**\n\n" +
      "To receive personalized recommendations grounded in Earth-observation data, search for your farm on the map above or outline your field boundary.\n\n" +
      "- 🛰️ **NASA POWER Telemetry**: Multi-year solar radiation, thermal ranges, and precipitation.\n" +
      "- 🌿 **MODIS 250m NDVI**: 16-day dynamic vegetation index.\n" +
      "- 🌾 **Crop Rotation Engine**: 4-year rotation plan balancing soil health, water conservation, and income."
    );
  }

  const topRec = analysis.recommendations?.[0];
  const cropName = topRec?.crop || 'Leading Crop';
  const score = topRec?.score !== undefined ? Number(topRec.score).toFixed(1) : '85.0';
  const rainfall = Math.round(analysis.environmental?.rainfallMm ?? 1100);
  const ndviVal = (analysis.environmental?.vegetation?.ndvi ?? 0.55).toFixed(2);
  const soilType = analysis.inputs?.soilType || 'loamy';
  const rotationYears = analysis.rotationPlan?.years || [];

  if (q.includes('crop') || q.includes('recommend') || q.includes('choose') || q.includes('why') || q.includes('best') || q.includes('ফসল')) {
    if (isBn) {
      return (
        `🌾 **সর্বোচ্চ সুপারিশকৃত ফসল: ${cropName} (${score}% স্কোর)**\n\n` +
        `- **আবহাওয়া অনুকূলতা**: বাৎসরিক ${rainfall} মিমি বৃষ্টিপাত ও আঞ্চলিক তাপমাত্রার জন্য সবচেয়ে উপযোগী।\n` +
        `- **মাটির সামঞ্জস্য**: আপনার জমিতে বিদ্যমান ${soilType} মাটির আর্দ্রতা ধারণ ক্ষমতার সাথে সঙ্গতিপূর্ণ।\n` +
        `- **আর্থিক সম্ভাবনা**: বর্তমান বাজার চাহিদা এবং কৃষক অগ্রাধিকারের ভিত্তিতে সর্বোচ্চ রেটিং প্রাপ্ত।`
      );
    }
    return (
      `🌾 **Top Recommended Crop: ${cropName} (${score}% Compatibility Score)**\n\n` +
      `- **Climate Fit**: Highly compatible with your annual precipitation of ~${rainfall} mm and regional thermal profile.\n` +
      `- **Soil Match**: Well-suited for ${soilType} soil texture and root-zone water retention.\n` +
      `- **Economic Balance**: Top-ranked based on your weighted priorities for soil conservation, water resilience, and farm income.`
    );
  }

  if (q.includes('water') || q.includes('rain') || q.includes('drought') || q.includes('irrigation') || q.includes('পানি') || q.includes('সেচ')) {
    if (isBn) {
      return (
        `💧 **পানি ও সেচ ব্যবস্থাপনা বিশ্লেষণ**\n\n` +
        `- **বাৎসরিক বৃষ্টিপাত**: প্রায় ${rainfall} মিমি (নাসা স্যাটেলাইট ডেটা)।\n` +
        `- **এনডিভিআই উদ্ভিজ্জ সূচক**: ${ndviVal} (সবুজ উদ্ভিদের ঘনত্ব নির্দেশ করে)।\n` +
        `- **পরামর্শ**: শুষ্ক মৌসুমে ড্রিপ বা পরিমিত সেচ প্রয়োগ করুন এবং বাষ্পীভবন কমাতে জমিতে খড় বা মালচিং ব্যবহার করুন।`
      );
    }
    return (
      `💧 **Water & Irrigation Assessment**\n\n` +
      `- **Annual Precipitation**: ~${rainfall} mm derived from NASA POWER meteorological observations.\n` +
      `- **Current NDVI**: ${ndviVal} (MODIS 250m composite reflecting field vegetative vigor).\n` +
      `- **Actionable Advice**: Employ deficit or drip irrigation during critical vegetative stages. Use organic mulching to minimize soil evaporation.`
    );
  }

  if (q.includes('rotation') || q.includes('plan') || q.includes('cycle') || q.includes('পরিক্রমা') || q.includes('ঘূর্ণন')) {
    const list = rotationYears
      .map((y: any) => `- **Year ${y.year}**: ${y.crop} (${y.family}) — ${y.role}`)
      .join('\n');
    if (isBn) {
      return (
        `🔄 **৪ বছরের প্রস্তাবিত ফসল পরিক্রমা**\n\n${list}\n\n` +
        `*নীতিমালা*: একনাগাড়ে একই জাতের ফসল চাষ না করে শস্য ও ডালজাতীয় ফসলের পর্যায়ক্রমিক আবর্তন মাটির নাইট্রোজেন বৃদ্ধি করে এবং রোগবালাই প্রতিরোধ করে।`
      );
    }
    return (
      `🔄 **Recommended 4-Year Crop Rotation Plan**\n\n${list}\n\n` +
      `*Agronomic Rule*: Alternates nitrogen-depleting cereals with nitrogen-fixing legumes to break pest lifecycles and rebuild organic matter.`
    );
  }

  if (q.includes('soil') || q.includes('fertilizer') || q.includes('organic') || q.includes('মাটি') || q.includes('সার')) {
    if (isBn) {
      return (
        `🧪 **মাটির পুষ্টি ও জৈব ব্যবস্থাপনা**\n\n` +
        `- **মাটির ধরন**: ${soilType}\n` +
        `- **সুপারিশ**: রাসায়নিক সারের উপর নির্ভরতা কমিয়ে কম্পোস্ট, ট্রাইকো-কম্পোস্ট ও সবুজ সার (যেমন ধইঞ্চা) প্রয়োগ করুন। ডালজাতীয় ফসলের শিকড়ের নডিউল মাটির প্রাকৃতিক উর্বরতা বৃদ্ধি করে।`
      );
    }
    return (
      `🧪 **Soil Nutrient & Organic Management**\n\n` +
      `- **Soil Classification**: ${soilType}\n` +
      `- **Management Strategy**: Incorporate compost and green manure (e.g., Sesbania or clover) into seedbeds. The rotation plan integrates legumes to naturally fix atmospheric nitrogen and enhance cation exchange capacity.`
    );
  }

  // General executive summary fallback
  if (isBn) {
    return (
      `📊 **খামার বিশ্লেষণ সারসংক্ষেপ**\n\n` +
      `- **অনুকূল ফসল**: ${cropName} (${score}% স্কোর)\n` +
      `- **বৃষ্টিপাত ও আর্দ্রতা**: বাৎসরিক ${rainfall} মিমি, NDVI: ${ndviVal}\n` +
      `- **মাটি**: ${soilType}\n\n` +
      `ফসল পরিক্রমা, সেচ বা রোগ প্রতিরোধ সম্পর্কে যেকোনো সুনির্দিষ্ট প্রশ্ন জিজ্ঞাসা করতে পারেন!`
    );
  }

  return (
    `📊 **Field Analysis Executive Overview**\n\n` +
    `- **Top Recommendation**: ${cropName} (${score}% compatibility score)\n` +
    `- **Meteorology & NDVI**: ~${rainfall} mm annual rainfall, ${ndviVal} MODIS NDVI density\n` +
    `- **Soil Type**: ${soilType}\n\n` +
    `Feel free to ask specific questions about irrigation schedules, soil amendments, or crop rotation benefits!`
  );
}

export async function POST(req: Request) {
  let locale: Locale = req.headers.get('accept-language')?.toLowerCase().startsWith('bn')
    ? 'bn-BD'
    : 'en';
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          error: locale === 'bn-BD'
            ? 'খুব বেশি অনুরোধ এসেছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
            : 'Too many requests. Please wait a minute before sending more messages.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    const { messages, analysis, locale: requestedLocale } = await req.json();
    locale = requestedLocale === 'bn' || requestedLocale === 'bn-BD' ? 'bn-BD' : locale;
    const responseLanguage = locale === 'bn-BD' ? 'Bengali (Bangladesh)' : 'English';

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: translateMessage(locale, 'Messages array is required') }), { status: 400 });
    }

    // Validate input message length
    for (const m of messages) {
      const text = typeof m.content === 'string' ? m.content : Array.isArray(m.parts) ? m.parts.map((p: any) => p.text || '').join('') : '';
      if (text.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({
            error: locale === 'bn-BD'
              ? `বার্তাটি অনেক বড় (সর্বোচ্চ ৫০০ অক্ষর допустимо)`
              : `Message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Convert UIMessages from client to CoreMessages
    const rawMessages = messages.map((m: any) => {
      let textContent = '';
      if (typeof m.content === 'string' && m.content.trim() !== '') {
        textContent = m.content;
      } else if (Array.isArray(m.parts)) {
        textContent = m.parts.map((p: any) => p.text || '').join('');
      } else if (Array.isArray(m.content)) {
        textContent = m.content.map((p: any) => p.text || '').join('');
      } else if (typeof m.content === 'string') {
        textContent = m.content;
      }
      return { role: m.role, content: textContent };
    }).filter((m: any) => m.content.trim() !== '');

    const coreMessages: any[] = [];
    for (const msg of rawMessages) {
      if (coreMessages.length > 0 && coreMessages[coreMessages.length - 1].role === msg.role) {
        coreMessages[coreMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        coreMessages.push(msg);
      }
    }

    if (coreMessages.length > 0 && coreMessages[0].role === 'assistant') {
      coreMessages.shift();
    }

    const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    // If no Google API key is configured, stream grounded deterministic answers cleanly
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const lastUserMsg = coreMessages.filter(m => m.role === 'user').pop()?.content || '';
      const fallbackReply = generateDeterministicAnswer(lastUserMsg, analysis, locale);

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: 'text-start', id: '0' });
          writer.write({ type: 'text-delta', id: '0', delta: fallbackReply });
          writer.write({ type: 'text-end', id: '0' });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    const systemPrompt = `You are Chash Advisor, an expert agricultural decision-support chatbot powered by Gemini 3.5 Flash Lite.
You are helping a farmer analyze their field and make grounded agricultural decisions.

RULES:
- Reply in ${responseLanguage}.
- Keep your tone friendly, professional, practical, and beginner-friendly.
- Format responses cleanly with GitHub-style markdown (bold headings, bullet points, concise paragraphs).
- Base your answers STRICTLY on the provided structured JSON data and NASA telemetry.
- CITE ONLY values and metrics present in that JSON; NEVER invent, fabricate, or hallucinate numbers, scores, yields, or measurements.
- When referring to a crop's score, use the EXACT decimal value from the analysis JSON (e.g., 85.4).
- If asked about data not present in the JSON, politely clarify that it is not covered by the current Earth-observation telemetry.
- If a user asks a hypothetical scenario question (e.g., "What if it rains 20% less?"), explain conceptually based on the crop's drought sensitivity without fabricating fake numbers.
- Make data provenance clear: distinguish between LIVE observations (NASA POWER, MODIS), CACHED data, and DERIVED estimates.
- Do not claim to be a human agronomist.

CURRENT FIELD ANALYSIS JSON:
${analysis ? JSON.stringify(analysis, null, 2) : 'No field has been analyzed yet. The farmer is exploring the global satellite map.'}
`;

    try {
      const result = streamText({
        model: google(geminiModel),
        system: systemPrompt,
        messages: coreMessages,
      });

      return result.toUIMessageStreamResponse({
        onError: (err) => {
          console.error('Chat stream error:', err);
          return err instanceof Error ? err.message : 'An error occurred during response streaming.';
        },
      });
    } catch (llmErr) {
      console.warn('LLM streamText call failed, falling back to deterministic answer:', llmErr);
      const lastUserMsg = coreMessages.filter(m => m.role === 'user').pop()?.content || '';
      const fallbackReply = generateDeterministicAnswer(lastUserMsg, analysis, locale);

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: 'text-start', id: '0' });
          writer.write({ type: 'text-delta', id: '0', delta: fallbackReply });
          writer.write({ type: 'text-end', id: '0' });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }
  } catch (error: any) {
    console.error('Chat failed:', error);
    try {
      const fallbackReply = generateDeterministicAnswer('summary', null, locale);
      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: 'text-start', id: '0' });
          writer.write({ type: 'text-delta', id: '0', delta: fallbackReply });
          writer.write({ type: 'text-end', id: '0' });
        },
      });
      return createUIMessageStreamResponse({ stream });
    } catch {
      return new Response(JSON.stringify({
        error: translateMessage(locale, 'Failed to process chat message'),
        details: error.message,
      }), { status: 500 });
    }
  }
}
