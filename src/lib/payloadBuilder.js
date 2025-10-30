// lib/payloadBuilder.js

const estTok = (s = '') => Math.ceil((s.length || 0) / 4);

// Configuration
const IMAGE_MEMORY_LOOKBACK = (typeof globalThis !== 'undefined' && globalThis.IMAGE_MEMORY_LOOKBACK) || 12; // Keep image context for last pairs

function countMsgTokens(m) {
  if (Array.isArray(m.content)) {
    const text = m.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
    const imgs = m.content.filter(p => p.type === 'image_url').length;
    return estTok(text) + imgs * 150;
  }
  return estTok(m.content || '');
}

function trimSummaryToBudget(summaryText, budgetTokens){
  if (!summaryText) return '';
  const bullets = summaryText
    .split('\n')
    .map(x => x.replace(/^•\s?/, '').trim())
    .filter(Boolean);
  if (!bullets.length) return '';
  let keep = bullets.slice();
  while (keep.length && estTok('• ' + keep.join('\n• ')) > budgetTokens) keep.pop();
  return keep.length ? '• ' + keep.join('\n• ') : '';
}

function includesImage(msg) {
  if (!msg) return false;
  // Check mm field first (multimodal parts), then content
  const content = Array.isArray(msg.content) ? msg.content : (msg.mm || null);
  if (content && Array.isArray(content)) {
    return content.some(p => p.type === 'image_url');
  }
  // Also check for markdown images in text content
  if (typeof msg.content === 'string') {
    return /!\[.*?\]\(data:image\//.test(msg.content);
  }
  return false;
}

function mentionsImageIn(newMsg) {
  if (!newMsg) return false;
  const text = Array.isArray(newMsg.content)
    ? (newMsg.content.find(p => p.type === 'text')?.text || '')
    : (newMsg.content || '');
  return /\b(image|photo|picture|pic|screenshot|this (?:img|photo|pic))\b/i.test(text);
}

function convertMarkdownImageToMultimodal(msg) {
  if (!msg || typeof msg.content !== 'string') return msg;
  
  const markdownImageMatch = msg.content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
  if (!markdownImageMatch) return msg;
  
  const imageUrl = markdownImageMatch[1];
  const textContent = msg.content.replace(/!\[.*?\]\(data:image\/[^)]+\)\n?\n?/, '').trim();
  
  return {
    ...msg,
    content: [
      ...(textContent ? [{ type: 'text', text: textContent }] : []),
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  };
}

function getLastImagePair(thread, maxLookback = 4) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  if (msgs.length < 2) return null;
  
  // Look back up to maxLookback messages to find the most recent image
  for (let i = msgs.length - 1; i >= 1 && i >= msgs.length - maxLookback; i--) {
    if (msgs[i - 1].role === 'user' && includesImage(msgs[i - 1])) {
      const userMsg = msgs[i - 1];
      // Use mm field if available, otherwise convert markdown
      const u = userMsg.mm ? { ...userMsg, content: userMsg.mm } : convertMarkdownImageToMultimodal(userMsg);
      const a = msgs[i] && msgs[i].role === 'assistant' ? msgs[i] : null;
      return { user: u, assistant: a };
    }
  }
  return null;
}

function getLastPair(thread) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  if (msgs.length < 2) return null;
  // find last "user" and optional assistant right after
  for (let i = msgs.length - 1; i >= 1; i--) {
    if (msgs[i - 1].role === 'user') {
      const userMsg = msgs[i - 1];
      // Use mm field if available, otherwise convert markdown
      const u = userMsg.mm ? { ...userMsg, content: userMsg.mm } : convertMarkdownImageToMultimodal(userMsg);
      const a = msgs[i] && msgs[i].role === 'assistant' ? msgs[i] : null;
      return { user: u, assistant: a };
    }
  }
  return null;
}

function getLastAssistantTexts(thread, count = 2, maxCharsPer = 600) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  const out = [];
  for (let i = msgs.length - 1; i >= 0 && out.length < count; i--) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    let txt = '';
    if (Array.isArray(m.content)) {
      txt = m.content.find(p => p.type === 'text')?.text || '';
    } else if (typeof m.content === 'string') {
      txt = m.content;
    }
    txt = (txt || '').trim();
    if (!txt) continue;
    if (txt.length > maxCharsPer) txt = txt.slice(0, maxCharsPer - 3) + '...';
    out.push(txt);
  }
  // Return oldest first for natural reading
  return out.reverse();
}

function isAffirmativeOrTiny(newMsg) {
  const txt = Array.isArray(newMsg?.content)
    ? (newMsg.content.find(p => p.type === 'text')?.text || '')
    : (newMsg?.content || '');
  const t = (txt || '').trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 12) return true;
  const YES_RE = /^(?:y|yes|yeah|yep|ok|okay|sure|do it|please do|go ahead|that works|sounds good|continue|next|proceed|right|correct|confirm|fine)[.!]?$/i;
  return YES_RE.test(t);
}

// Small, safe recent context (last 1 Q→A), only if we have room
function buildRecencyContext(thread, maxChars = 700) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  if (msgs.length < 2) return '';
  // Find last user and the assistant right after it
  for (let i = msgs.length - 1; i >= 1; i--) {
    if (msgs[i - 1].role === 'user') {
      const u = msgs[i - 1];
      const uTxt = Array.isArray(u.content)
        ? (u.content.find(p => p.type === 'text')?.text || '')
        : (u.content || '');

      // Only include the last user input to reduce repetition of assistant phrasing
      let block = `U: ${uTxt}`;
      if (block.length > maxChars) block = block.slice(0, maxChars - 3) + '...';
      return block.trim();
    }
  }
  return '';
}

// Build payload: global rules + persona/default + trimmed summary (+ optional tiny recency) + new message
export function buildPayload({ thread, newMsg, keepRecent = 40, tokenCap = 6000 }) {
  const DEFAULT_SYSTEM = "You are a concise, helpful assistant. Prefer facts over speculation. If unsure, say so briefly. Use provided context faithfully.";

  const assistantName = (thread?.title || '').trim();
  const GLOBAL_RULES = [
    'Global rules:',
    '- Never claim to be ChatGPT or a language model; do not mention model details (knowledge cutoff, current date) unless the user asks.',
    `- Introduce yourself only if the user explicitly asks who you are; otherwise do not state your identity. If asked, reply: "I’m your ${assistantName || 'assistant'} in ChatCloud."`,
    '- Do not repeat your identity in subsequent messages unless asked again.',
    '- Skip greetings and fluff; start with the substance. Keep responses concise and actionable. Ask at most one clarifying question if the request is ambiguous.',
  ].join('\n');

  const sys = [
    { role: 'system', content: GLOBAL_RULES },
    thread.system ? { role: 'system', content: thread.system } : { role: 'system', content: DEFAULT_SYSTEM },
  ];
  const rawSummary = thread.summary ? `Context summary:\n${thread.summary}` : '';

  const safeCount = (m) => {
    try {
      return typeof countMsgTokens === 'function' ? countMsgTokens(m) : estTok(String(m?.content ?? ''));
    } catch {
      return estTok(String(m?.content ?? ''));
    }
  };
  const safeTrimSummary = (summaryText, room) => {
    try {
      return typeof trimSummaryToBudget === 'function' ? trimSummaryToBudget(summaryText, room) : summaryText.slice(0, Math.max(0, room * 4));
    } catch {
      return '';
    }
  };
  const base = [...sys, newMsg];
  const baseTokens = base.reduce((n, m) => n + safeCount(m), 0);
  // Insert summary within budget
  let payload = base;
  if (rawSummary) {
    const room = Math.max(0, tokenCap - baseTokens);
    const trimmedSummary = safeTrimSummary(rawSummary, room);
    if (trimmedSummary) {
      console.log('[AI Payload] Context summary:', trimmedSummary);
      payload = [...sys, { role: 'system', content: trimmedSummary }, newMsg];
    } else {
      console.log('[AI Payload] Summary trimmed out (no room).');
    }
  }

  // Optional tiny recency: prefer the REAL last pair if it had an image
  const USE_RECENCY = true;
  if (USE_RECENCY) {
    const tokensNow = payload.reduce((n, m) => n + safeCount(m), 0);
    const headroom = tokenCap - tokensNow;

    if (headroom > 256) {
      // First try to find any recent image pair (up to IMAGE_MEMORY_LOOKBACK messages back)
      let imagePair = null;
      let lastPair = null;
      try { imagePair = typeof getLastImagePair === 'function' ? getLastImagePair(thread, IMAGE_MEMORY_LOOKBACK) : null; } catch {}
      try { lastPair = typeof getLastPair === 'function' ? getLastPair(thread) : null; } catch {}

      // If we found a recent image pair OR the new message mentions an image,
      // re-insert that image exchange verbatim (roles + content), before the current user msg.
      const mentionsImg = (() => { try { return typeof mentionsImageIn === 'function' ? mentionsImageIn(newMsg) : false; } catch { return false; } })();
      const lastHasImg = (() => { try { return typeof includesImage === 'function' ? includesImage(lastPair?.user) : false; } catch { return false; } })();
      if (imagePair && (mentionsImg || lastHasImg)) {
        const candidate = [
          ...payload.slice(0, -1), // everything except the current user msg
          imagePair.user,
          ...(imagePair.assistant ? [imagePair.assistant] : []),
          newMsg
        ];
        const candTokens = candidate.reduce((n, m) => n + safeCount(m), 0);
        if (candTokens <= tokenCap) {
          console.log('[AI Payload] Including recent image exchange for context:', {
            user: imagePair.user,
            assistant: imagePair.assistant,
          });
          payload = candidate;
        }
      } else {
        // fallback to tiny text-only recency (your existing behavior)
        let recency = '';
        try { recency = typeof buildRecencyContext === 'function' ? buildRecencyContext(thread, 700) : ''; } catch {}
        if (recency) {
          const candidate = [
            ...payload.slice(0, -1),
            { role: 'system', content: `Recency context:\n${recency}` },
            newMsg
          ];
          const candTokens = candidate.reduce((n, m) => n + safeCount(m), 0);
          if (candTokens <= tokenCap) {
            console.log('[AI Payload] Recency context:', recency);
            payload = candidate;
          }
        }
      }
      // If the new user input is low-signal (e.g., "yes"), include up to 2 prior assistant lines
      if (isAffirmativeOrTiny(newMsg)) {
        const assistants = getLastAssistantTexts(thread, 2, 600);
        if (assistants.length) {
          const recap = assistants.map(a => `A: ${a}`).join('\n');
          const candidate = [
            ...payload.slice(0, -1),
            { role: 'system', content: recap },
            newMsg,
          ];
          const candTokens = candidate.reduce((n, m) => n + safeCount(m), 0);
          if (candTokens <= tokenCap) {
            console.log('[AI Payload] Assistant recap included:', assistants.map(s => s.slice(0, 120)));
            payload = candidate;
          } else if (assistants.length > 1) {
            // Try with only the most recent assistant line if both won't fit
            const recap1 = `A: ${assistants[assistants.length - 1]}`;
            const candidate1 = [
              ...payload.slice(0, -1),
              { role: 'system', content: recap1 },
              newMsg,
            ];
            const candTokens1 = candidate1.reduce((n, m) => n + safeCount(m), 0);
            if (candTokens1 <= tokenCap) {
              console.log('[AI Payload] Assistant recap (1) included:', recap1.slice(0, 120));
              payload = candidate1;
            }
          }
        }
      }
    }
  }


  const finalTokens = payload.reduce((n, m) => n + safeCount(m), 0);
  if (finalTokens > tokenCap && payload.length > 2) {
    console.log('[AI Payload] Payload exceeded token cap, falling back to system + new message only.');
    return [payload[0], payload[payload.length - 1]];
  }

  console.log('[AI Payload] Final messages sent:', payload);
  return payload;
}

export function needsSummaryUpdate(thread) {
  const { shouldUpdateSummary } = require('./summaryBuilder');
  return shouldUpdateSummary(thread);
}

export function getPayloadSize(payload) {
  return payload.reduce((n, m) => n + countMsgTokens(m), 0);
}
