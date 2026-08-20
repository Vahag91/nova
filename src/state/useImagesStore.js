import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { createRunwareImages } from '../api/runware';
import { toLocalPath, deleteLocalFile } from '../lib/imageDownloader';
import { normalizeImageUri, cacheToFile, cleanupCorruptedCache } from '../lib/imageUtils';
import RNFS from 'react-native-fs';
import { ensureDeviceId } from '../lib/deviceId';
import { v4 as uuidv4 } from 'uuid';
import { perfEnd, perfStart } from '../lib/perfTrace';
// Advanced mode helper functions are now handled by createRunwareImages API

let imagesHydrationPromise = null;
let imagesRepairPromise = null;
let imagesRepairCompleted = false;

function normalizePersistedJobs(jobs) {
  return (jobs || []).filter(Boolean).map(j => ({
    id: j.id,
    chatId: j.chatId ?? null,
    prompt: j.prompt || '',
    model: j.model || 'runware-flux-schnell',
    mode: j.mode || 'text2img',
    size: j.size || '1024x1024',
    n: j.n || 1,
    status: j.status || 'done',
    images: Array.isArray(j.images) ? j.images : [],
    error: j.error || null,
    createdAt: j.createdAt || Date.now(),
    updatedAt: j.updatedAt || j.createdAt || Date.now(),
  })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

// Advanced modes now use createRunwareImages API directly

function buildImageGenerationUserError(error, fallbackMessage) {
  const message =
    typeof fallbackMessage === 'string' && fallbackMessage.trim()
      ? fallbackMessage.trim()
      : 'Image generation failed.';
  const next = new Error(message);
  next.code = error?.code || 'generation_failed';
  return next;
}

export const useImagesStore = create((set, get) => ({
  coinsBalance: null,
  setCoinsBalance: (balance) => {
    const nextBalance = typeof balance === 'number' ? balance : null;
    set(state => (
      state.coinsBalance === nextBalance
        ? state
        : { coinsBalance: nextBalance }
    ));
  },
  // ===== persisted (normal) =====
  jobs: [],
  hydrated: false,
  
  hydrate: async () => {
    if (get().hydrated) return;
    if (imagesHydrationPromise) return imagesHydrationPromise;

    imagesHydrationPromise = (async () => {
      perfStart('images_store.hydrate');
      const normalized = normalizePersistedJobs(await Storage.loadImages());
      set({ jobs: normalized, hydrated: true });
      perfEnd('images_store.hydrate', {
        jobs: normalized.length,
        images: normalized.reduce(
          (sum, job) => sum + (job?.images?.length || 0),
          0,
        ),
      });

    })().finally(() => {
      imagesHydrationPromise = null;
    });

    return imagesHydrationPromise;
  },

  repairImageCache: async () => {
    await get().hydrate();
    if (imagesRepairCompleted) return;
    if (imagesRepairPromise) return imagesRepairPromise;

    const sourceJobs = get().jobs;
    imagesRepairPromise = (async () => {
      try {
        await cleanupCorruptedCache();
      } catch {}

      const repaired = sourceJobs.map(job => ({
        ...job,
        images: (job.images || []).map(image => ({ ...image })),
      }));
      let checked = 0;
      let changed = false;

      for (const job of repaired) {
        for (const image of job.images) {
          const isLocal = image.url?.startsWith('file://');
          let localIsValid = !isLocal;

          if (isLocal) {
            try {
              const filePath = image.url.slice('file://'.length);
              const exists = await RNFS.exists(filePath);
              localIsValid =
                exists && Number((await RNFS.stat(filePath)).size) > 0;
            } catch {
              localIsValid = false;
            }
          }

          const needsRepair = image.needsCacheRepair || (isLocal && !localIsValid);
          if (
            needsRepair &&
            image.originalUrl &&
            /^https?:\/\//i.test(image.originalUrl)
          ) {
            let recached = image.originalUrl;
            try {
              recached = await cacheToFile(image.originalUrl);
            } catch {}
            const cacheRestored = recached?.startsWith('file://');
            image.url = cacheRestored ? recached : image.originalUrl;
            image.needsCacheRepair = !cacheRestored;
            changed = true;
          } else if (localIsValid && image.needsCacheRepair) {
            delete image.needsCacheRepair;
            changed = true;
          }

          checked += 1;
          if (checked % 6 === 0) await yieldToUi();
        }
      }

      const sameRevision = get().jobs === sourceJobs;
      if (changed && sameRevision) {
        set({ jobs: repaired });
        await Storage.saveImages(repaired);
      }
      imagesRepairCompleted =
        sameRevision &&
        !repaired.some(job =>
          (job.images || []).some(image => image.needsCacheRepair),
        );
    })().finally(() => {
      imagesRepairPromise = null;
    });

    return imagesRepairPromise;
  },

  // Auto-save helper
  _save: () => {
    const { jobs } = get();
    Storage.saveImages(jobs);
  },

  createJob: async ({ 
    prompt, 
    model='runware-flux-schnell', 
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
    scheduler,
    includeCost,
    checkNSFW,
    acceleration,
    referenceImages,
    advancedFeatures,
    outputType='URL',
    outputFormat='JPG',
    outputQuality=95,
  }) => {
    // Metadata hydration is single-flight and cheap. Finish it before creating
    // and persisting a charged job so delayed startup work cannot overwrite the
    // new job or the user's existing gallery.
    await get().hydrate();
    
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
      scheduler,
      includeCost,
      checkNSFW,
      acceleration,
      referenceImages,
      advancedFeatures,
    };
    
    set(state => ({ jobs: [job, ...state.jobs] }));
    get()._save(); // Auto-save

    try {
      const deviceIdForCoins = await ensureDeviceId();
      if (!deviceIdForCoins) {
        throw new Error('Device unavailable. Please restart the app.');
      }

      const spendJobId = uuidv4();
      const res = await createRunwareImages({
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
        scheduler,
        includeCost,
        checkNSFW,
        acceleration,
        referenceImages,
        advancedFeatures,
        deviceId: deviceIdForCoins,
        jobId: spendJobId,
      });

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
      if (typeof res?.pricing?.balance === 'number') {
        set({ coinsBalance: res.pricing.balance });
      }
      
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
        }
      }
      
      return updatedJob;
    } catch (error) {
      // Provide more user-friendly error messages
      let userMessage = error?.message || error?.toString() || 'Image generation failed';
      
      if (error?.code === 'restricted_content' || /restricted|nsfw|content not allowed/i.test(userMessage)) {
        userMessage = 'Restricted content blocked by safety filters. No coins were charged.';
      } else if (
        error?.code === 'invalid_image_response' ||
        /temporarily unavailable|cloudflare|expected an image|html error page|supported image/i.test(userMessage)
      ) {
        userMessage = 'The generated image file was temporarily unavailable. Please try again.';
      } else if (/not enough coins/i.test(userMessage)) {
        userMessage = 'Not enough coins available for this request.';
      } else if (userMessage.includes('unknownErrorWhileReadingResults')) {
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
      
      throw buildImageGenerationUserError(error, userMessage);
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
      const updatedJobs = state.jobs.map((entry) => {
        if (entry.id === jobId) {
          const updatedImages = (entry.images || []).filter((img) => img.id !== imageId);
          return {
            ...entry,
            images: updatedImages,
            updatedAt: Date.now(),
          };
        }
        return entry;
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
        model: job.model || 'runware-flux-schnell',
        size: job.size || '1024x1024',
        n: job.n || 1,
      }));
      return { jobs: normalized };
    });
    get()._save();
  },

  // Helper to ingest results from advanced generation modes
  _ingestResults: async (data, { mode, input }) => {
    await get().hydrate();
    const { jobId, ...restInput } = input || {};
    const id = jobId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job = {
      id,
      chatId: null,
      prompt: restInput.prompt || '',
      model: restInput.model || 'runware-flux-schnell',
      size: restInput.size || '1024x1024',
      n: 1,
      status: 'running',
      images: [],
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode,
      ...restInput,
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
      
      if (error?.code === 'restricted_content' || /restricted|nsfw|content not allowed/i.test(userMessage)) {
        userMessage = 'Restricted content blocked by safety filters. No coins were charged.';
      } else if (
        error?.code === 'invalid_image_response' ||
        /temporarily unavailable|cloudflare|expected an image|html error page|supported image/i.test(userMessage)
      ) {
        userMessage = 'The generated image file was temporarily unavailable. Please try again.';
      } else if (userMessage.includes('unknownErrorWhileReadingResults')) {
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

      throw buildImageGenerationUserError(error, userMessage);
    }
  },

  // Advanced generation actions
  runImg2Img: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'img2img' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'img2img', input: opts });
  },

  runInpaint: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'inpaint' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'inpaint', input: opts });
  },

  runOutpaint: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'outpaint' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'outpaint', input: opts });
  },

  runRedux: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'redux' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'redux', input: opts });
  },

  runCanny: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'canny' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'canny', input: opts });
  },

  runDepth: async (opts) => {
    const deviceId = await ensureDeviceId();
    if (!deviceId) throw new Error('Device unavailable. Please restart the app.');
    const spendJobId = uuidv4();
    const data = await createRunwareImages({ ...opts, jobId: spendJobId, deviceId, mode: 'depth' });
    if (typeof data?.pricing?.balance === 'number') {
      set({ coinsBalance: data.pricing.balance });
    }
    return get()._ingestResults(data, { mode: 'depth', input: opts });
  },
}));
