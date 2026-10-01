import { DEFAULT_CHAT_MODEL } from '../config/models';

// Message supports future modalities
export const newUserMessage = (text) => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  role: 'user',            // 'user' | 'assistant' | 'system' | 'tool'
  type: 'text',            // 'text' | 'image' | 'audio' | 'video' | 'tool_result'
  content: text,
  attachments: [],         // [{type:'image'|'audio'|'file', uri, mime, meta}]
  meta: {},                // {model, tokens, ...}
  job: null,               // reserved for long jobs (v2)
  createdAt: Date.now(),
});

export const newAssistantMessage = () => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  role: 'assistant',
  type: 'text',
  content: '',
  attachments: [],
  meta: {},
  job: null,
  createdAt: Date.now(),
});
export const newSystemMessage = (text) => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  role: 'system',
  type: 'text',
  content: text,
  attachments: [],
  meta: {},
  job: null,
  createdAt: Date.now(),
});

export const newThread = ({title='Cloud AI assistant', model=DEFAULT_CHAT_MODEL, system=null} = {}) => ({
  id: `thr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  title,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  model,
  system,                 // preset system prompt (optional)
  messages: [],
  summary: '',            // running summary of last 50 messages
  summaryUpdatedAt: 0,    // timestamp when summary was last updated
  pinned: false,          // pinned threads appear first in list
});
