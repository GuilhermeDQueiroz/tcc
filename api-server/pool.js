// Open the bounded pool before loading large frames; release every successful
// connection even if another handshake fails. The pool owns their lifecycle.
export async function warmPool(pool){
  const results=await Promise.allSettled(Array.from({length:pool.options.max},()=>pool.connect()));
  for(const result of results)if(result.status==='fulfilled')result.value.release();
  const failure=results.find(result=>result.status==='rejected');
  if(failure)throw failure.reason;
}
