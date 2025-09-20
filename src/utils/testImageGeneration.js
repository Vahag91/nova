// Quick test script for image generation (dev menu / console)
// Import this in your dev environment or add to a dev menu

import { useImagesStore } from '../state/useImagesStore';

export const testImageGeneration = {
  // text2img – FLUX dev
  text2imgFluxDev: () => {
    useImagesStore.getState().createJob({
      prompt: "cinematic portrait, soft rim light, 85mm, kodak portra",
      model: "runware-flux-dev",
      size: "1024x1024",
      mode: "text2img",
      steps: 28,
      CFGScale: 9,
    });
  },

  // img2img – SDXL
  img2imgSDXL: (seedImageUrl) => {
    useImagesStore.getState().runImg2Img({
      prompt: "same composition, more dramatic lighting",
      model: "runware-sdxl-civitai",
      size: "1024x1024",
      seedImage: seedImageUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
      strength: 0.6,
      steps: 30,
      CFGScale: 7.5,
    });
  },

  // img2img – FLUX Canny (ideally pass an edge map as seedImage)
  img2imgFluxCanny: (seedImageUrl) => {
    useImagesStore.getState().runImg2Img({
      prompt: "comic-y cel shaded style",
      model: "runware-flux-canny",
      size: "1024x1024",
      seedImage: seedImageUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
      strength: 0.75,
      steps: 24,
      CFGScale: 8,
    });
  },

  // Test all models with text2img
  testAllModelsText2img: () => {
    const models = ['runware-flux-dev', 'runware-flux-schnell', 'runware-sdxl-civitai'];
    models.forEach((model, index) => {
      setTimeout(() => {
        useImagesStore.getState().createJob({
          prompt: `Test image ${index + 1} - ${model}`,
          model,
          size: "1024x1024",
          mode: "text2img",
        });
      }, index * 2000); // Stagger requests by 2 seconds
    });
  },

  // Test size limits
  testSizeLimits: () => {
    // Test FLUX with large size (should work)
    useImagesStore.getState().createJob({
      prompt: "FLUX large size test",
      model: "runware-flux-dev",
      size: "1536x1024", // ~1.5M pixels, should work
      mode: "text2img",
    });

    // Test SDXL with large size (should fail or auto-adjust)
    setTimeout(() => {
      useImagesStore.getState().createJob({
        prompt: "SDXL large size test",
        model: "runware-sdxl-civitai",
        size: "1536x1024", // ~1.5M pixels, should fail
        mode: "text2img",
      });
    }, 3000);
  },

  // Test model auto-selection for img2img
  testModelAutoSelection: () => {
    // Try to use a model that doesn't support img2img (should auto-select FLUX)
    useImagesStore.getState().runImg2Img({
      prompt: "test auto-selection",
      model: "runware-flux-dev", // This should work
      size: "1024x1024",
      seedImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      strength: 0.7,
    });
  }
};

// Console helpers for easy testing
if (__DEV__) {
  global.testImageGeneration = testImageGeneration;
  console.log('🧪 Test functions available:');
  console.log('- testImageGeneration.text2imgFluxDev()');
  console.log('- testImageGeneration.img2imgSDXL(seedImageUrl)');
  console.log('- testImageGeneration.img2imgFluxCanny(seedImageUrl)');
  console.log('- testImageGeneration.testAllModelsText2img()');
  console.log('- testImageGeneration.testSizeLimits()');
  console.log('- testImageGeneration.testModelAutoSelection()');
}

export default testImageGeneration;
