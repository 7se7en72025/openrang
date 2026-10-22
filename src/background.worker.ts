/// <reference lib="webworker" />
import { removeBackground } from "@imgly/background-removal";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (
  event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number }>,
) => {
  try {
    const { width, height, pixels } = event.data;
    const input = new Blob([pixels], {
      type: `image/x-rgba8;width=${width};height=${height}`,
    });
    const blob = await removeBackground(input, {
      model: "isnet_quint8",
      device: "cpu",
      output: { format: "image/x-rgba8" },
      progress: (key, current, total) =>
        scope.postMessage({
          progress: key.startsWith("fetch")
            ? `Downloading model · ${total ? Math.round((current / total) * 100) : 0}%`
            : "Removing background on your device…",
        }),
    });
    const output = await blob.arrayBuffer();
    let foreground = false;
    const values = new Uint8Array(output);
    for (let i = 3; i < values.length; i += 4)
      if (values[i] > 20) {
        foreground = true;
        break;
      }
    if (!foreground)
      throw Error(
        "No foreground was found. Your original image is unchanged. Try a clearer subject.",
      );
    scope.postMessage({ pixels: output, width, height }, [output]);
  } catch (error) {
    scope.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Background removal failed. Please try again.",
    });
  }
};
