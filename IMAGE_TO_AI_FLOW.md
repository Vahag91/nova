# Image-to-AI Functionality Breakdown

## Overview
This document breaks down the image-to-AI functionality in the Aily app, explaining how images are sent to AI models and how responses are processed.

## Architecture

### Core Components

1. **ImagesStudio Screen** (`src/screens/ImagesStudio.js`)
   - Main UI for image generation
   - Handles user input and mode selection
   - Orchestrates the generation flow

2. **useImagesStore** (`src/state/useImagesStore.js`)
   - State management for image generation jobs
   - Handles different generation modes
   - Processes API responses

3. **Runware API** (`src/api/runware.js`)
   - Main API interface for image generation
   - Supports multiple generation modes
   - Handles request/response logging

4. **Image Upload** (`src/lib/runwareUpload.ts`)
   - Handles image uploads to get imageUUIDs
   - Processes different image formats
   - Manages upload responses

## Generation Modes

### 1. Text-to-Image (`text2img`)
- **Input**: Text prompt only
- **Process**: Direct text-to-image generation
- **API**: `createRunwareImages()` with mode='text2img'

### 2. Image-to-Image (`img2img`)
- **Input**: Text prompt + seed image + strength parameter
- **Process**: Transforms existing image based on prompt
- **API**: `createRunwareImages()` with mode='img2img'
- **Parameters**: `seedImage`, `strength` (0-1)

### 3. Inpaint (`inpaint`)
- **Input**: Text prompt + seed image + mask image
- **Process**: Edits specific areas of image (white=edit, black=keep)
- **API**: `createRunwareImages()` with mode='inpaint'
- **Parameters**: `seedImage`, `maskImage`

### 4. Outpaint (`outpaint`)
- **Input**: Text prompt + seed image + outpaint dimensions
- **Process**: Extends image beyond original boundaries
- **API**: `createRunwareImages()` with mode='outpaint'
- **Parameters**: `seedImage`, `outpaint` (top, right, bottom, left, blur)

### 5. Redux (`redux`)
- **Input**: Text prompt + guide image + model parameters
- **Process**: Style transfer using IP-Adapter models
- **API**: `createRunwareImages()` with mode='redux'
- **Parameters**: `guideImage`, `baseModel`, `ipAdapterModel`

### 6. Canny (`canny`)
- **Input**: Text prompt + edge map image
- **Process**: Generates image from edge detection
- **API**: `createRunwareImages()` with mode='canny'
- **Parameters**: `seedImage` (edge map)

### 7. Depth (`depth`)
- **Input**: Text prompt + depth map image
- **Process**: Generates image from depth information
- **API**: `createRunwareImages()` with mode='depth'
- **Parameters**: `seedImage` (depth map)

## Data Flow

### 1. User Interaction
```
User selects mode → User provides input → User clicks Generate
```

### 2. Parameter Preparation
```
ImagesStudio.js → Validates inputs → Prepares base parameters
```

### 3. API Call
```
useImagesStore → createRunwareImages() → Runware API
```

### 4. Image Processing
```
API Response → Image URL processing → Local storage (if base64)
```

### 5. State Update
```
Processed images → Job status update → UI refresh
```

## Logging System

### Request Logging
- **Start**: Mode, model, prompt preview, input validation
- **API Call**: Request URL, body size, parameters
- **Response**: Status, headers, response data

### Image Processing Logging
- **Upload**: Image type, size, upload status
- **Processing**: Image count, URL types, processing steps
- **Storage**: Local file paths, data URI handling

### Error Logging
- **API Errors**: Status codes, error messages, request details
- **Processing Errors**: Error types, stack traces, context
- **Network Errors**: Connection issues, timeout handling

## Key Functions

### Image Generation Flow
```javascript
// 1. User triggers generation
onGenerate() → ImagesStudio.js

// 2. Store creates job
createJob() → useImagesStore.js

// 3. API call based on mode
createRunwareImages() → runware.js

// 4. Response processing
_ingestResults() → useImagesStore.js

// 5. UI update
State update → ImagesStudio.js
```

### Image Upload Flow
```javascript
// 1. User selects image
ImageUpload.jsx → onImageSelected()

// 2. Upload to get UUID
uploadImage() → runwareUpload.ts

// 3. Store UUID for generation
setSeedImage() → ImagesStudio.js
```

## Error Handling

### API Errors
- Network failures
- Invalid parameters
- Rate limiting
- Server errors

### Processing Errors
- Image format issues
- Upload failures
- Storage problems
- Invalid responses

### User Input Errors
- Missing required images
- Invalid parameters
- Empty prompts (where required)

## Performance Considerations

### Image Optimization
- Base64 to local file conversion
- Image size validation
- Format standardization

### Caching
- Job state persistence
- Image URL caching
- Failed job cleanup

### Memory Management
- Large image handling
- Base64 data processing
- Local file cleanup

## Security

### API Authentication
- Supabase anon key for local development
- Bearer token authentication
- Request validation

### Image Privacy
- Local file storage
- Secure upload endpoints
- Data URI handling

## Future Enhancements

### Planned Features
- Batch generation
- Image variations
- Advanced parameter tuning
- Real-time progress updates

### Technical Improvements
- WebSocket streaming
- Image compression
- Offline generation
- Multi-model support
