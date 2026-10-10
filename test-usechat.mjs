import { Chat } from 'ai';
const chat = new Chat();
chat.messages = [
  { id: '1', role: 'user', content: 'hello' }
];
console.log(chat.messages);
