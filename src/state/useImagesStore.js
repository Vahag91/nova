import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { createImages } from '../api/images';            // existing OpenAI/DALL·E function
import { createRunwareImages } from '../api/runware';    // NEW
import { toLocalPath, deleteLocalFile } from '../lib/imageDownloader';
import { normalizeImageUri, cacheToFile, cleanupCorruptedCache } from '../lib/imageUtils';
import RNFS from 'react-native-fs';
import { SUPABASE_BASE, SUPABASE_ANON_KEY } from '../config/endpoints';
// Advanced mode helper functions are now handled by createRunwareImages API

const RUNWARE_KEYS = new Set([
  'runware-flux-dev',
  'runware-flux-schnell',
  'runware-flux-canny',
  'runware-sdxl-civitai',
]);

// Advanced modes now use createRunwareImages API directly

export const useImagesStore = create((set, get) => ({
  // ===== persisted (normal) =====
  jobs: [],
  hydrated: false,
  
  hydrate: async () => {
    // Clean up corrupted cache files on startup
    try {
      await cleanupCorruptedCache();
    } catch (error) {
      // Silent cleanup failure
    }
    
    const jobs = await Storage.loadImages();
    
    // normalize on load and validate image files
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
    
    // Validate and fix broken image URLs
    for (const job of normalized) {
      if (job.images && job.images.length > 0) {
        for (const img of job.images) {
          if (img.url && img.url.startsWith('file://')) {
            try {
              const filePath = img.url.replace('file://', '');
              const exists = await RNFS.exists(filePath);
              if (!exists || (await RNFS.stat(filePath)).size === 0) {
                // File is missing or corrupted, try to re-cache from original URL
                if (img.originalUrl && /^https?:\/\//i.test(img.originalUrl)) {
                  const newUrl = await cacheToFile(img.originalUrl);
                  if (newUrl && newUrl !== img.originalUrl) {
                    img.url = newUrl;
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to validate image file:', img.url, error);
            }
          }
        }
      }
    }
    
    normalized.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    set({ jobs: normalized, hydrated: true });
    
    // Save the updated jobs with fixed URLs
    Storage.saveImages(normalized);
  },

  // Auto-save helper
  _save: () => {
    const { jobs } = get();
    Storage.saveImages(jobs);
  },

  createJob: async ({ 
    prompt, 
    model='runware-flux-dev', 
    size='1024x1024', 
    n=1, 
    chatId=null, 
    autoInsertToThread=false,
    // Advanced mode parameters
    mode='text2img',
    seedImage,
    maskImage,
    strength=0.85,
    outpaint,
    guideImage,
    baseModel,
    ipAdapterModel,
    CFGScale,
    outputType='URL',
    outputFormat='JPG',
    outputQuality=95,
  }) => {
    
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
      updatedAt: Date.now(),
      // Advanced mode data
      mode,
      seedImage,
      maskImage,
      strength,
      outpaint,
      guideImage,
      baseModel,
      ipAdapterModel,
      CFGScale,
      outputType,
      outputFormat,
      outputQuality,
    };
    
    set(state => ({ jobs: [job, ...state.jobs] }));
    get()._save(); // Auto-save
    
    try {
      const isRunware = RUNWARE_KEYS.has(model);
      const res = isRunware
        ? await createRunwareImages({ 
            prompt, 
            model, 
            size,
            mode,
            seedImage,
            maskImage,
            strength,
            outpaint,
            guideImage,
            baseModel,
            ipAdapterModel,
            CFGScale,
            outputType,
            outputFormat,
            outputQuality,
          })
        : await createImages({ prompt, model, size, n: 1 });       // existing OpenAI/DALL·E

      const imgs = await Promise.all((res.images || []).map(async (img, i) => {
        const raw = img?.url || '';
        const normalized = normalizeImageUri(raw);
        if (!normalized) {
          return null;
        }
        
        // Cache remote URLs to local files
        let localUri;
        try {
          localUri = /^https?:\/\//i.test(normalized) ? await cacheToFile(normalized) : normalized;
        } catch (cacheError) {
          localUri = normalized; // fallback to original
        }
        
        let safe;
        try {
          safe = localUri.startsWith('data:image/') ? await toLocalPath(localUri) : localUri;
        } catch (processError) {
          safe = localUri; // fallback to localUri
        }
        
        // Ensure unique ID by combining job ID with image ID
        const uniqueId = img?.id ? `${id}:${img.id}` : `${id}:${i}`;
        const finalImage = { 
          id: uniqueId, 
          url: safe, 
          originalUrl: raw, // Preserve original URL for re-caching
          index: i 
        };
        
        return finalImage;
      }));
      
      // Filter out null results from invalid URLs
      const validImgs = imgs.filter(Boolean);

      const updatedJob = { 
        ...job, 
        status: 'done', 
        images: validImgs,
        error: null,
        size: res.size || job.size,
        updatedAt: Date.now()
      };
      
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
      
      return updatedJob;
    } catch (error) {
      // Provide more user-friendly error messages
      let userMessage = error?.message || error?.toString() || 'Image generation failed';
      
      if (userMessage.includes('unknownErrorWhileReadingResults')) {
        userMessage = 'Runware service is temporarily unavailable. Please try again in a moment.';
      } else if (userMessage.includes('500') || userMessage.includes('502')) {
        userMessage = 'Server error occurred. Please try again.';
      } else if (userMessage.includes('rate limit') || userMessage.includes('quota')) {
        userMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      }
      
      const failedJob = { 
        ...job, 
        status: 'failed', 
        error: userMessage,
        images: [],
        updatedAt: Date.now()
      };
      
      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? failedJob : j)
      }));
      get()._save(); // Auto-save
      
      throw error;
    }
  },

  deleteJob: (jobId) => {
    const { jobs } = get();
    const job = jobs.find(j => j.id === jobId);
    
    job?.images?.forEach(img => { 
      if (img?.url?.startsWith('file://')) {
        deleteLocalFile(img.url);
      }
    });
    
    set({ jobs: jobs.filter(j => j.id !== jobId) });
    get()._save();
  },

  clearFailed: () => {
    set(state => {
      const filtered = state.jobs.filter(j => j && j.status !== 'failed');
      return { jobs: filtered };
    });
    get()._save();
  },

  // Delete a specific image from a job
  deleteImage: (jobId, imageId) => {
    const { jobs } = get();
    const job = jobs.find(j => j.id === jobId);
    const image = job?.images?.find(img => img.id === imageId);
    
    // Clean up local file if it exists
    if (image?.url?.startsWith('file://')) {
      deleteLocalFile(image.url);
    }
    
    set((state) => {
      const updatedJobs = state.jobs.map((job) => {
        if (job.id === jobId) {
          const updatedImages = (job.images || []).filter((img) => img.id !== imageId);
          return {
            ...job,
            images: updatedImages,
            updatedAt: Date.now(),
          };
        }
        return job;
      });
      return { jobs: updatedJobs };
    });
    get()._save();
  },

  
  clearStaleJobs: () => {
    const now = Date.now();
    set(state => {
      const filtered = state.jobs.filter(j => 
        j && 
        j.status !== 'failed' && 
        !(j.status === 'running' && j.createdAt && (now - j.createdAt) > 5 * 60 * 1000)
      );
      return { jobs: filtered };
    });
    get()._save();
  },

  clearAllJobs: () => {
    set(state => {
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
      return { jobs: normalized };
    });
    get()._save();
  },

  // Helper to ingest results from advanced generation modes
  _ingestResults: async (data, { mode, input }) => {
    
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job = {
      id,
      chatId: null,
      prompt: input.prompt || '',
      model: input.model || 'runware-flux-dev',
      size: input.size || '1024x1024',
      n: 1,
      status: 'running',
      images: [],
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode,
      ...input,
    };

    // Add to store
    set(state => ({ jobs: [job, ...state.jobs] }));
    get()._save();

    try {
      // Process the results
      const imagesArray = data?.data || data?.images || [];
      
      const images = await Promise.all(imagesArray.map(async (item, i) => {
        const raw = item?.imageURL || item?.imageUrl || item?.url || '';
        const normalized = normalizeImageUri(raw);
        if (!normalized) {
          return null;
        }
        
        // Cache remote URLs to local files
        const localUri = /^https?:\/\//i.test(normalized) ? await cacheToFile(normalized) : normalized;
        const safe = localUri.startsWith('data:image/') ? await toLocalPath(localUri) : localUri;
        
        // Ensure unique ID by combining job ID with image ID
        const uniqueId = item?.taskUUID ? `${id}:${item.taskUUID}` : 
                        item?.id ? `${id}:${item.id}` : 
                        `${id}:${i}`;
        
        return { 
          id: uniqueId, 
          url: safe, 
          originalUrl: raw, // Preserve original URL for re-caching
          index: i 
        };
      }));
      
      // Filter out null results from invalid URLs
      const validImages = images.filter(Boolean);

      const updatedJob = {
        ...job,
        status: 'done',
        images: validImages,
        error: null,
        updatedAt: Date.now(),
      };

      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? updatedJob : j)
      }));
      get()._save();

      return updatedJob;
    } catch (error) {
      // Provide more user-friendly error messages
      let userMessage = error?.message || error?.toString() || 'Image generation failed';
      
      if (userMessage.includes('unknownErrorWhileReadingResults')) {
        userMessage = 'Runware service is temporarily unavailable. Please try again in a moment.';
      } else if (userMessage.includes('500') || userMessage.includes('502')) {
        userMessage = 'Server error occurred. Please try again.';
      } else if (userMessage.includes('rate limit') || userMessage.includes('quota')) {
        userMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      }
      
      const failedJob = {
        ...job,
        status: 'failed',
        error: userMessage,
        images: [],
        updatedAt: Date.now(),
      };

      set(state => ({
        jobs: state.jobs.map(j => j.id === id ? failedJob : j)
      }));
      get()._save();

      throw error;
    }
  },

  // Advanced generation actions
  runImg2Img: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'img2img' });
    return get()._ingestResults(data, { mode: 'img2img', input: opts });
  },

  runInpaint: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'inpaint' });
    return get()._ingestResults(data, { mode: 'inpaint', input: opts });
  },

  runOutpaint: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'outpaint' });
    return get()._ingestResults(data, { mode: 'outpaint', input: opts });
  },

  runRedux: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'redux' });
    return get()._ingestResults(data, { mode: 'redux', input: opts });
  },

  runCanny: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'canny' });
    return get()._ingestResults(data, { mode: 'canny', input: opts });
  },

  runDepth: async (opts) => {
    const data = await createRunwareImages({ ...opts, mode: 'depth' });
    return get()._ingestResults(data, { mode: 'depth', input: opts });
  },
}));
