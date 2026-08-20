import { runImagePickerSingleFlight } from '../src/lib/imagePickerSingleFlight';

describe('image picker single-flight lock', () => {
  test('allows only one picker launch across 20 rapid attempts', async () => {
    let resolvePicker;
    const launchPicker = jest.fn(
      () =>
        new Promise(resolve => {
          resolvePicker = resolve;
        }),
    );

    const attempts = Array.from({ length: 20 }, () =>
      runImagePickerSingleFlight(launchPicker),
    );

    expect(launchPicker).toHaveBeenCalledTimes(1);

    resolvePicker({ assets: [{ uri: 'file://photo.jpg' }] });

    const results = await Promise.all(attempts);
    expect(results.filter(result => result.started)).toHaveLength(1);
    expect(results.filter(result => !result.started)).toHaveLength(19);
  });

  test('prevents Camera and Gallery launches from overlapping', async () => {
    let resolveCamera;
    const launchCamera = jest.fn(
      () =>
        new Promise(resolve => {
          resolveCamera = resolve;
        }),
    );
    const launchGallery = jest.fn(() => Promise.resolve({ didCancel: true }));

    const cameraAttempt = runImagePickerSingleFlight(launchCamera);
    const galleryAttempt = await runImagePickerSingleFlight(launchGallery);

    expect(galleryAttempt).toEqual({ started: false });
    expect(launchGallery).not.toHaveBeenCalled();

    resolveCamera({ assets: [{ uri: 'file://camera.jpg' }] });
    await cameraAttempt;
  });

  test('releases the lock after cancellation and errors', async () => {
    await expect(
      runImagePickerSingleFlight(() => Promise.resolve({ didCancel: true })),
    ).resolves.toEqual({
      started: true,
      response: { didCancel: true },
    });

    await expect(
      runImagePickerSingleFlight(() => Promise.reject(new Error('picker failed'))),
    ).rejects.toThrow('picker failed');

    await expect(
      runImagePickerSingleFlight(() =>
        Promise.resolve({ assets: [{ uri: 'file://reopened.jpg' }] }),
      ),
    ).resolves.toEqual({
      started: true,
      response: { assets: [{ uri: 'file://reopened.jpg' }] },
    });
  });
});
