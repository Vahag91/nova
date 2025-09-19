import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { createImages } from '../api/images';            // existing OpenAI/DALL·E function
import { createRunwareImages } from '../api/runware';    // NEW
import { toLocalPath, deleteLocalFile } from '../lib/imageDownloader';

const RUNWARE_KEYS = new Set([
  'runware-flux-dev',
  'runware-flux-schnell',
  'runware-qwen-image',
  'runware-gemini-flash',
]);

export const useImagesStore = create((set, get) => ({
  // ===== persisted (normal) =====
  jobs: [],
  hydrated: false,
  
  hydrate: async () => {
    const jobs = await Storage.loadImages();
    // normalize on load
    const normalized = (jobs || []).filter(Boolean).map(j => ({
      id: j.id,
      chatId: j.chatId ?? null,
      prompt: j.prompt || '',
      model: j.model || 'runware-flux-dev',
      size: j.size || '1024x1024',
      n: j.n || 1,
      status: j.status || 'done',
      images: Array.isArray(j.images) ? j.images : [],
      error: j.error || null,
      createdAt: j.createdAt || Date.now(),
      updatedAt: j.updatedAt || j.createdAt || Date.now(),
    }));
    normalized.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    set({ jobs: normalized, hydrated: true });
  },

  // Auto-save helper
  _save: () => {
    const { jobs } = get();
    Storage.saveImages(jobs);
  },

  createJob: async ({ prompt, model='runware-flux-dev', size='1024x1024', n=1, chatId=null, autoInsertToThread=false }) => {
    console.log('🏭 [STORE] createJob called with:', { prompt, model, size, n, chatId });
    
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job = { 
      id, 
      chatId,
      prompt: (prompt || '').trim(), 
      model, 
      size, 
      n: Math.max(1, Math.min(n, 4)), 
      status: 'running', 
      images: [], 
      error: null, 
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    console.log('🏭 [STORE] Created job:', job);
    set(state => ({ jobs: [job, ...state.jobs] }));
    get()._save(); // Auto-save
    console.log('🏭 [STORE] Job added to store, current jobs count:', get().jobs.length);
    
    try {
      const isRunware = RUNWARE_KEYS.has(model);
      console.log('🏭 [STORE] Using provider:', isRunware ? 'Runware' : 'OpenAI');

      const res = isRunware
        ? await createRunwareImages({ prompt, model, size })       // forced 512 server-side
        : await createImages({ prompt, model, size, n: 1 });       // existing OpenAI/DALL·E

      console.log('🏭 [STORE] API response received:', res);
      
      const imgs = await Promise.all((res.images || []).map(async (img, i) => {
        const raw = img?.url || '';
        const safe = raw.startsWith('data:image/') ? await toLocalPath(raw) : raw; // base64 → file://
        return { id: img?.id || `${id}:${i}`, url: safe, index: i };
      }));

      const updatedJob = { 
        ...job, 
        status: 'done', 
        images: imgs,
        error: null,
        size: res.size || job.size,
        updatedAt: Date.now()
      };
      
      console.log('🏭 [STORE] Updating job to done:', updatedJob);
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? updatedJob : j)
      }));
      get()._save(); // Auto-save
      
      // Auto-insert to thread if requested
      if (autoInsertToThread && chatId && imgs[0]?.url) {
        try {
          const { useThreadsStore } = require('./useThreadsStore');
          const addMessage = useThreadsStore.getState().addMessage;
          const md = `Here is the image for:\n\n> ${job.prompt}\n\n![image](${imgs[0].url})`;
          addMessage(chatId, { 
            id: `${id}-msg`, 
            role: 'assistant', 
            content: md, 
            createdAt: Date.now() 
          });
        } catch (error) {
          console.warn('Failed to auto-insert image to thread:', error);
        }
      }
      
      console.log('✅ [STORE] Job completed successfully');
      return updatedJob;
    } catch (error) {
      console.error('❌ [STORE] Job failed with error:', error);
      
      const failedJob = { 
        ...job, 
        status: 'failed', 
        error: error?.message || error?.toString() || 'Failed',
        images: [],
        updatedAt: Date.now()
      };
      
      console.log('🏭 [STORE] Updating job to failed:', failedJob);
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? failedJob : j)
      }));
      get()._save(); // Auto-save
      
      console.log('❌ [STORE] Job marked as failed');
      throw error;
    }
  },

  deleteJob: (jobId) => {
    const { jobs } = get();
    const job = jobs.find(j => j.id === jobId);
    job?.images?.forEach(img => { 
      if (img?.url?.startsWith('file://')) deleteLocalFile(img.url); 
    });
    set({ jobs: jobs.filter(j => j.id !== jobId) });
    get()._save();
  },

  clearFailed: () => {
    console.log('🧹 [STORE] clearFailed called');
    set(state => {
      const filtered = state.jobs.filter(j => j && j.status !== 'failed');
      console.log('🧹 [STORE] Cleared failed jobs, remaining:', filtered.length);
      return { jobs: filtered };
    });
    get()._save();
  },
  
  clearStaleJobs: () => {
    console.log('🧹 [STORE] clearStaleJobs called');
    const now = Date.now();
    set(state => {
      const filtered = state.jobs.filter(j => 
        j && 
        j.status !== 'failed' && 
        !(j.status === 'running' && j.createdAt && (now - j.createdAt) > 5 * 60 * 1000)
      );
      console.log('🧹 [STORE] Cleared stale jobs, remaining:', filtered.length);
      return { jobs: filtered };
    });
    get()._save();
  },

  clearAllJobs: () => {
    console.log('🧹 [STORE] clearAllJobs called');
    set(state => {
      console.log('🧹 [STORE] Cleared all jobs, was:', state.jobs.length);
      return { jobs: [] };
    });
    get()._save();
  },

  prune: (limit = 200) => {
    set(state => ({ jobs: state.jobs.slice(0, limit) }));
    get()._save();
  },

  // Ensure all jobs have required properties
  normalizeJobs: () => {
    console.log('🔧 [STORE] normalizeJobs called');
    set(state => {
      const normalized = state.jobs.filter(job => job && job.id).map(job => ({
        ...job,
        chatId: job.chatId ?? null,
        error: job.error || null,
        images: Array.isArray(job.images) ? job.images : [],
        createdAt: job.createdAt || Date.now(),
        updatedAt: job.updatedAt || job.createdAt || Date.now(),
        status: job.status || 'unknown',
        prompt: job.prompt || '',
        model: job.model || 'runware-flux-dev',
        size: job.size || '1024x1024',
        n: job.n || 1,
      }));
      console.log('🔧 [STORE] Normalized jobs:', normalized.length);
      return { jobs: normalized };
    });
    get()._save();
  },
}));
