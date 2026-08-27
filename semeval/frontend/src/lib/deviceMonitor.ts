export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

export async function getMicrophoneDevices(): Promise<AudioDeviceInfo[]> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [{ deviceId: "default", label: "Default Microphone" }];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");
    return audioInputs.map((d, index) => ({
      deviceId: d.deviceId || `mic-${index}`,
      label: d.label || `Microphone ${index + 1}`,
    }));
  } catch (err) {
    console.error("Error enumerating audio devices:", err);
    return [{ deviceId: "default", label: "Default Microphone" }];
  }
}

export function subscribeDeviceChanges(callback: () => void): () => void {
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", callback);
    return () => navigator.mediaDevices.removeEventListener("devicechange", callback);
  }
  return () => {};
}
