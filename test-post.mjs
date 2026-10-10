const body = {
  analysis: { field: { latitude: 23.8 } },
  messages: [
    { role: 'user', parts: [{ type: 'text', text: 'Hi, I am Bob.' }] },
    { role: 'assistant', parts: [{ type: 'text', text: 'Hello Bob!' }] },
    { role: 'user', parts: [{ type: 'text', text: 'What is my name?' }] }
  ]
};

fetch('http://localhost:3000/api/field/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}).then(async r => {
  console.log(r.status);
  const text = await r.text();
  console.log(text.substring(0, 100));
}).catch(e => console.log('Error:', e.message));
