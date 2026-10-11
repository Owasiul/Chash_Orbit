import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import dotenv from 'dotenv';
dotenv.config();

const result = streamText({
  model: google('gemini-3.8-flash'),
  prompt: 'hello'
});

console.log('toUIMessageStreamResponse:', typeof result.toUIMessageStreamResponse);
