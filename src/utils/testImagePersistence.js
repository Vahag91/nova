// Test utility to verify image persistence
import { useImagesStore } from '../state/useImagesStore';
import { Storage } from '../lib/storage';

export const testImagePersistence = async () => {
  console.log('🧪 Testing image persistence...');
  
  try {
    // Test 1: Create a mock job
    const mockJob = {
      id: 'test-job-123',
      chatId: 'test-chat-456',
      prompt: 'Test image generation',
      model: 'runware-flux-dev',
      size: '1024x1024',
      n: 1,
      status: 'done',
      images: [
        {
          id: 'test-img-1',
          url: 'https://example.com/test-image.jpg',
          index: 0
        }
      ],
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Test 2: Save to storage
    await Storage.saveImages([mockJob]);
    console.log('✅ Test job saved to storage');

    // Test 3: Load from storage
    const loadedJobs = await Storage.loadImages();
    console.log('✅ Jobs loaded from storage:', loadedJobs.length);

    // Test 4: Verify data integrity
    const loadedJob = loadedJobs.find(j => j.id === 'test-job-123');
    if (loadedJob && loadedJob.prompt === 'Test image generation') {
      console.log('✅ Data integrity verified');
    } else {
      console.log('❌ Data integrity failed');
    }

    // Test 5: Clean up
    await Storage.saveImages([]);
    console.log('✅ Test cleanup completed');

    return true;
  } catch (error) {
    console.error('❌ Image persistence test failed:', error);
    return false;
  }
};
