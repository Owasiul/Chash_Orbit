import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const coreMessages = [
    { role: 'user', content: [{ type: 'text', text: 'What is my name?' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Your name is Bob.' }] },
    { role: 'user', content: [{ type: 'text', text: 'Say my name.' }] }
  ];

  try {
    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      messages: coreMessages
    });
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
  } catch(e) {
    console.log("FAIL:", e);
  }
}
run();
