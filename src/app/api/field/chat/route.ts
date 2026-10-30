import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { translateMessage, type Locale } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  let locale: Locale = req.headers.get('accept-language')?.toLowerCase().startsWith('bn')
    ? 'bn-BD'
    : 'en';
  try {
    const { messages, analysis, locale: requestedLocale } = await req.json();
    locale = requestedLocale === 'bn' || requestedLocale === 'bn-BD' ? 'bn-BD' : locale;
    const responseLanguage = locale === 'bn-BD' ? 'Bengali (Bangladesh)' : 'English';

    if (!messages || !analysis) {
      return new Response(JSON.stringify({ error: translateMessage(locale, 'Messages and analysis data are required') }), { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: translateMessage(locale, 'LLM API key is not configured') }), { status: 500 });
    }

    const systemPrompt = `You are a professional agricultural decision-support assistant answering a farmer's questions.

RULES:
- Reply in ${responseLanguage}. Keep crop names and NASA product names recognizable.
- Base your answers ONLY on the provided field analysis data.
- NEVER invent, fabricate, or hallucinate measurements, crop yields, scores, or environmental data.
- When referring to a crop's score, use the EXACT decimal value from the analysis data (e.g., 85.4). Do not round it to a whole number.
- Do not blindly agree with leading questions if the data does not support them.
- If a user asks a scenario question (e.g., "What if it rains less?"), explain how the current variables would be affected conceptually, but clarify that you cannot re-run the numerical model.
- Make data provenance clear: mention if data is LIVE (e.g., NASA observations), CACHED, DERIVED, or DEMO.
- Do not claim to be a human agronomist. Recommend consulting local extension professionals for critical decisions.

CURRENT FIELD ANALYSIS DATA:
${JSON.stringify(analysis, null, 2)}
`;

    // Convert UIMessages from the client to CoreMessages for streamText
    console.log("INCOMING MESSAGES:", JSON.stringify(messages, null, 2));

    console.log("INCOMING MESSAGES: ", JSON.stringify(messages, null, 2));
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

    // Gemini requires strictly alternating roles (user -> model -> user -> model)
    const coreMessages: any[] = [];
    for (const msg of rawMessages) {
      if (coreMessages.length > 0 && coreMessages[coreMessages.length - 1].role === msg.role) {
        // Merge consecutive messages of the same role
        coreMessages[coreMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        coreMessages.push(msg);
      }
    }
    
    // Gemini MUST start with a user message (after the system prompt, which is handled separately)
    if (coreMessages.length > 0 && coreMessages[0].role === 'assistant') {
      coreMessages.shift();
    }


    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      system: systemPrompt,
      messages: coreMessages
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('Chat failed:', error);
    return new Response(JSON.stringify({
      error: translateMessage(locale, 'Failed to process chat message'),
      details: error.message,
    }), { status: 500 });
  }
}
