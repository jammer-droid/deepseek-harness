const url = new URL(process.env.STUDIO_VERIFY_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '19388') throw Error('Isolated preview only');
const auth = await fetch(url, { redirect: 'manual' });
const cookie = auth.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
export async function rpc(method, request) {
  const r = await fetch(new URL('/api/' + method, url), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args: { request } } }), signal: AbortSignal.timeout(30000) });
  const b = await r.json(); if (!b.result.ok) throw Error(JSON.stringify(b)); return b.result.value;
}
const sessionId = process.argv[2];
if (process.argv[3] === 'prompt') console.log(await rpc('session/prompt', { sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text: process.argv[4] }] }));
else {
 const projection = await rpc('session/projections', {sessionId});
 const page = await rpc('session/page', { address: {kind:'session',sessionId}, throughSeq: projection.asOfSeq, maxMessages: 100 });
 console.log(JSON.stringify({projection,page}, null, 2));
}
