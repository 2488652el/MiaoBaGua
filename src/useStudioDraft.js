import { useCallback, useRef, useState } from 'react';
import { bridge } from './bridge.js';

// The editor owns its value synchronously. IPC acknowledgements and AI broadcasts
// must never replace an in-progress edit or the browser's IME composition range.
export function useStudioDraft(initialDraft, act) {
  const [draft,setDraft]=useState(()=>({...initialDraft}));
  const latest=useRef(draft);
  const composing=useRef(new Set());
  const lastSent=useRef(JSON.stringify(draft));
  const save=useCallback(()=>{
    if(composing.current.size)return;
    const snapshot={...latest.current},serialized=JSON.stringify(snapshot);
    if(serialized===lastSent.current)return;
    lastSent.current=serialized;
    act(async()=>{
      try { await bridge.setDraft(snapshot); }
      catch(error) { if(lastSent.current===serialized)lastSent.current=null;throw error; }
    });
  },[act]);
  const update=useCallback((field,value)=>{
    latest.current={...latest.current,[field]:value};
    setDraft(latest.current);
    save();
  },[save]);
  const compositionStart=useCallback(field=>{composing.current.add(field);},[]);
  const compositionEnd=useCallback((field,value)=>{
    composing.current.delete(field);
    update(field,value);
  },[update]);
  const snapshot=useCallback(()=>({...latest.current}),[]);
  const isComposing=useCallback(()=>composing.current.size>0,[]);
  return {draft,update,compositionStart,compositionEnd,snapshot,isComposing};
}
