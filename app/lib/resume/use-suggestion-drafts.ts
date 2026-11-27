"use client";

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiPost } from '../api/client';
import type { ResumeContent } from '../dashboard/types';

export interface SuggestionDraft {term:string;skills:string[];detail:string;entryId:string;experience:boolean}
export async function prepareDrafts(content:ResumeContent,items:Array<{term:string;entryId?:string}>,jdText?:string) {
  const drafts:SuggestionDraft[]=[];
  for(let at=0;at<items.length;at+=24) {
    drafts.push(...await apiPost<SuggestionDraft[]>('/api/ai/suggestions/drafts',{content,items:items.slice(at,at+24),...(jdText?{jdText}: {})}));
  }
  return drafts;
}

/** One request per bank, shared by renders. Preparing wording never changes the resume. */
export function useSuggestionDrafts(content:ResumeContent|null|undefined,items:Array<{term:string;entryId?:string}>,jdText?:string) {
  const {data:session,status}=useSession();
  return useQuery({queryKey:['suggestion-drafts-v1',session?.user?.id,content,items,jdText],
    queryFn:()=>prepareDrafts(content!,items,jdText),enabled:Boolean(status==='authenticated' && content && items.length),
    staleTime:5*60_000,gcTime:5*60_000,retry:1,refetchOnWindowFocus:false});
}
