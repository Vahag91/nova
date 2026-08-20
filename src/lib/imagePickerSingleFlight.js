let imagePickerInFlight = false;

export async function runImagePickerSingleFlight(launchPicker) {
  if (imagePickerInFlight) {
    return { started: false };
  }

  imagePickerInFlight = true;
  try {
    return {
      started: true,
      response: await launchPicker(),
    };
  } finally {
    imagePickerInFlight = false;
  }
}
