// src/lib/runware.ts
export type ImageRef = string; // imageUUID | data:uri | base64 | public URL

export type Mode = 'img2img' | 'inpaint' | 'outpaint' | 'redux' | 'canny' | 'depth';

export interface CommonParams {
  model?: string;
  width: number;
  height: number;
  steps?: number;
  CFGScale?: number;
  outputType?: 'URL' | 'dataURI' | 'base64Data';
  outputFormat?: 'JPG' | 'PNG' | 'WEBP';
  outputQuality?: number; // JPG/WEBP quality
  positivePrompt?: string; // use "__BLANK__" to let model decide (esp. outpaint)
}

export interface Img2ImgParams extends CommonParams {
  seedImage: ImageRef;
  strength: number; // 0..1 (FLUX useful >= 0.8)
}

export interface InpaintParams extends CommonParams {
  seedImage: ImageRef;
  maskImage: ImageRef; // white=edit, black=keep
  // FLUX Fill ignores strength + maskMargin
}

export interface OutpaintParams extends CommonParams {
  seedImage: ImageRef;
  outpaint: { top?: number; right?: number; bottom?: number; left?: number; blur?: number };
  // Use Fill model; omit strength
}

export interface ReduxParams extends CommonParams {
  baseModel?: string;              // e.g. "runware:101@1"
  ipAdapterModel?: string;         // "runware:105@1"
  guideImage: ImageRef;
}

export interface CannyDepthParams extends CommonParams {
  seedImage: ImageRef; // edge/depth map
}

export function snap64(n: number) {
  const r = Math.max(128, Math.min(2048, Math.round(n / 64) * 64));
  return r;
}

export function with64Dims<T extends {width:number;height:number}>(p: T): T {
  return { ...p, width: snap64(p.width), height: snap64(p.height) };
}

// Build tasks the way your Supabase function expects (array of tasks)
export function buildImg2ImgTask(p: Img2ImgParams) {
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.model ?? 'runware:101@1',      // FLUX dev
    positivePrompt: p.positivePrompt ?? '',
    seedImage: p.seedImage,
    strength: p.strength,                   // used here (not for Fill)
    width: q.width,
    height: q.height,
    steps: p.steps ?? 30,
    CFGScale: p.CFGScale ?? 9,
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
  }];
}

export function buildInpaintTask(p: InpaintParams) {
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.model ?? 'runware:102@1', // FLUX Fill
    positivePrompt: p.positivePrompt ?? '',
    seedImage: p.seedImage,
    maskImage: p.maskImage,            // white=edit, black=keep
    width: q.width,
    height: q.height,
    steps: p.steps ?? 30,
    CFGScale: p.CFGScale ?? 10,
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
    // NOTE: no strength, no maskMargin for Fill
  }];
}

export function buildOutpaintTask(p: OutpaintParams) {
  // Recompute final dims if you manage canvas yourself elsewhere.
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.model ?? 'runware:102@1', // FLUX Fill
    positivePrompt: p.positivePrompt ?? '__BLANK__',
    seedImage: p.seedImage,
    outpaint: {
      top: snap64(p.outpaint.top ?? 0),
      right: snap64(p.outpaint.right ?? 0),
      bottom: snap64(p.outpaint.bottom ?? 0),
      left: snap64(p.outpaint.left ?? 0),
      blur: p.outpaint.blur ?? 12,
    },
    width: q.width,
    height: q.height,
    steps: p.steps ?? 30,
    CFGScale: p.CFGScale ?? 12,       // outpaint benefits from higher CFG
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
    // NOTE: omit strength with Fill
  }];
}

export function buildReduxTask(p: ReduxParams) {
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.baseModel ?? 'runware:101@1', // base FLUX
    positivePrompt: p.positivePrompt ?? '__BLANK__', // docs say may have no effect
    ipAdapters: [{
      model: p.ipAdapterModel ?? 'runware:105@1',
      guideImage: p.guideImage,
    }],
    width: q.width,
    height: q.height,
    steps: p.steps ?? 28,
    CFGScale: p.CFGScale ?? 9,
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
  }];
}

export function buildCannyTask(p: CannyDepthParams) {
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.model ?? 'runware:104@1', // FLUX Canny
    positivePrompt: p.positivePrompt ?? '',
    seedImage: p.seedImage,            // edge map
    width: q.width,
    height: q.height,
    steps: p.steps ?? 30,
    CFGScale: p.CFGScale ?? 9,
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
  }];
}

export function buildDepthTask(p: CannyDepthParams) {
  const q = with64Dims(p);
  return [{
    taskType: 'imageInference',
    model: p.model ?? 'runware:103@1', // FLUX Depth
    positivePrompt: p.positivePrompt ?? '',
    seedImage: p.seedImage,            // depth map
    width: q.width,
    height: q.height,
    steps: p.steps ?? 30,
    CFGScale: p.CFGScale ?? 9,
    outputType: p.outputType ?? 'URL',
    outputFormat: p.outputFormat ?? 'JPG',
    outputQuality: p.outputQuality ?? 95,
  }];
}
