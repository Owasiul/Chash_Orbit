import { DefaultChatTransport } from 'ai';
const transport = new DefaultChatTransport({ api: '/api/test' });
console.log(transport.sendMessages.toString());
