import { create } from 'zustand';
import { createImages } from '../api/images';            // existing OpenAI/DALL·E function
import { createRunwareImages } from '../api/runware';    // NEW

const RUNWARE_KEYS = new Set([
  'runware-flux-dev',
  'runware-flux-schnell',
  'runware-qwen-image',
  'runware-gemini-flash',
]);

export const useImagesStore = create((set, get) => ({
  jobs: [],

  createJob: async ({ prompt, model='runware-flux-dev', size='1024x1024', n=1 }) => {
    console.log('🏭 [STORE] createJob called with:', { prompt, model, size, n });
    
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job = { 
      id, 
      prompt: prompt || '', 
      model, 
      size, 
      n, 
      status: 'running', 
      images: [], 
      error: null, 
      createdAt: Date.now() 
    };
    
    console.log('🏭 [STORE] Created job:', job);
    set(state => ({ jobs: [job, ...state.jobs] }));
    console.log('🏭 [STORE] Job added to store, current jobs count:', get().jobs.length);
    
    try {
      const isRunware = RUNWARE_KEYS.has(model);
      console.log('🏭 [STORE] Using provider:', isRunware ? 'Runware' : 'OpenAI');

      const res = isRunware
        ? await createRunwareImages({ prompt, model, size })       // forced 512 server-side
        : await createImages({ prompt, model, size, n: 1 });       // existing OpenAI/DALL·E

      console.log('🏭 [STORE] API response received:', res);
      
      const updatedJob = { 
        ...job, 
        status: 'done', 
        images: res.images || [],
        error: null,
        size: res.size || job.size
      };
      
      console.log('🏭 [STORE] Updating job to done:', updatedJob);
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? updatedJob : j)
      }));
      
      console.log('✅ [STORE] Job completed successfully');
      return updatedJob;
    } catch (error) {
      console.error('❌ [STORE] Job failed with error:', error);
      
      const failedJob = { 
        ...job, 
        status: 'failed', 
        error: error?.message || error?.toString() || 'Failed',
        images: []
      };
      
      console.log('🏭 [STORE] Updating job to failed:', failedJob);
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? failedJob : j)
      }));
      
      console.log('❌ [STORE] Job marked as failed');
      throw error;
    }
  },

  clearFailed: () => {
    console.log('🧹 [STORE] clearFailed called');
    set(state => {
      const filtered = state.jobs.filter(j => j && j.status !== 'failed');
      console.log('🧹 [STORE] Cleared failed jobs, remaining:', filtered.length);
      return { jobs: filtered };
    });
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
  },

  clearAllJobs: () => {
    console.log('🧹 [STORE] clearAllJobs called');
    set(state => {
      console.log('🧹 [STORE] Cleared all jobs, was:', state.jobs.length);
      return { jobs: [] };
    });
  },

  // Ensure all jobs have required properties
  normalizeJobs: () => {
    console.log('🔧 [STORE] normalizeJobs called');
    set(state => {
      const normalized = state.jobs.filter(job => job && job.id).map(job => ({
        ...job,
        error: job.error || null,
        images: Array.isArray(job.images) ? job.images : [],
        createdAt: job.createdAt || Date.now(),
        status: job.status || 'unknown',
        prompt: job.prompt || '',
        model: job.model || 'runware-flux-dev',
        size: job.size || '1024x1024',
        n: job.n || 1,
      }));
      console.log('🔧 [STORE] Normalized jobs:', normalized.length);
      return { jobs: normalized };
    });
  },
}));
