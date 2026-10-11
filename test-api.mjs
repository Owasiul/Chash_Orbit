import { Chat } from 'ai';
const chat = new Chat({ api: '/api/test', body: { a: 1 } });
console.log(chat.options);
