import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const coreMessages = [
    { role: 'user', content: 'My name is Bob. I like apples.' },
    { role: 'assistant', content: [{ type: 'text', text: 'Nice to meet you, Bob.' }] }, 
    { role: 'user', content: 'What is my name and what do I like?' }
  ];

  try {
    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      messages: coreMessages
    });
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    console.log("RESPONSE WITH ARRAY:", fullText);
  } catch(e) {
    console.log("FAIL:", e);
  }
}
run();
