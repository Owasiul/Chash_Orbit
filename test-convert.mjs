import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const coreMessages = [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] }, // If I pass array here, will it crash?
    { role: 'user', content: 'How are you?' }
  ];

  try {
    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      messages: coreMessages
    });
    for await (const chunk of result.textStream) {}
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAIL:", e);
  }
}
run();
