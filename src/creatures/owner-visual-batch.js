/** Coalesce visual-only solves between rendered updates. Physics still evaluates
 * every fixed step and supplies the final authoritative contacts/phase. The exact
 * sum of elapsed time reaches each mixer; zero-delta reset hooks outside a batch
 * remain immediate. This does not skip controller steps or weaken contact tests. */
export function createOwnerVisualBatch(){
 let open=false;const pending=new Map();
 return {
  hook(adapter){if(typeof adapter?.update!=='function')throw new TypeError('Visual update adapter required');return {update(dt){if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid visual delta');if(!open)return adapter.update(dt);pending.set(adapter,(pending.get(adapter)??0)+dt);}};},
  begin(){if(open)throw new Error('Nested visual batch');open=true;},
  end(){if(!open)throw new Error('No visual batch');open=false;const rows=[...pending];pending.clear();for(const [adapter,dt] of rows)adapter.update(dt);},
 };
}
