const DEFAULT_MODELS = {
  'gpt-4o-mini': { provider:'openai', kind:'chat', caps:{text:true,image:false,audio:false,video:false}, display:{name:'GPT-4o mini', group:'OpenAI'} },
  'gpt-4o':      { provider:'openai', kind:'chat', caps:{text:true,image:true, audio:true, video:false}, display:{name:'GPT-4o', group:'OpenAI'} },
  'claude-3-haiku':  { provider:'anthropic', kind:'chat', caps:{text:true,image:false,audio:false,video:false}, display:{name:'Claude 3 Haiku', group:'Anthropic'} },
  'claude-3.7-sonnet': { provider:'anthropic', kind:'chat', caps:{text:true,image:true,audio:false,video:false}, display:{name:'Claude 3.7 Sonnet', group:'Anthropic'} },
  'gemini-2.5-pro': { provider:'google', kind:'chat', caps:{text:true,image:true,audio:true,video:false}, display:{name:'Gemini 2.5 Pro', group:'Google'} },
};
export default DEFAULT_MODELS;
