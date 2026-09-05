import { Editor } from "@tiptap/core";
import { IIdeMessenger } from "../../../../context/IdeMessenger";

const IMAGE_RESOLUTION = 1024;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function resolveImageMime(file: File): string | undefined {
  if (file.type && ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return file.type === "image/jpg" ? "image/jpeg" : file.type;
  }
  // Finder / Electron sometimes omit MIME — infer from extension.
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? EXT_TO_MIME[ext] : undefined;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader returned non-string result"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}

/**
 * Downscale for chat payloads. Prefer PNG when the source has alpha;
 * otherwise JPEG. Falls back to the original data URL if canvas fails.
 */
function getDataUrlForFile(
  file: File,
  img: HTMLImageElement,
  originalDataUrl: string,
): string {
  try {
    if (!img.width || !img.height) {
      return originalDataUrl;
    }

    const scaleFactor = Math.min(
      IMAGE_RESOLUTION / img.width,
      IMAGE_RESOLUTION / img.height,
      1,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scaleFactor));
    canvas.height = Math.max(1, Math.round(img.height * scaleFactor));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return originalDataUrl;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const preferPng =
      file.type === "image/png" ||
      file.type === "image/gif" ||
      file.type === "image/webp" ||
      /\.png$/i.test(file.name) ||
      /\.gif$/i.test(file.name) ||
      /\.webp$/i.test(file.name);

    return canvas.toDataURL(preferPng ? "image/png" : "image/jpeg", 0.85);
  } catch {
    return originalDataUrl;
  }
}

export async function handleImageFile(
  ideMessenger: IIdeMessenger,
  file: File,
): Promise<[HTMLImageElement, string] | undefined> {
  const mime = resolveImageMime(file);
  const filesizeMb = file.size / 1024 / 1024;

  if (!mime || filesizeMb >= 10) {
    ideMessenger.post("showToast", [
      "error",
      "Images need to be jpg, png, gif, or webp and less than 10MB.",
    ]);
    return undefined;
  }

  // Prefer FileReader → data: URLs. VS Code webview CSP often blocks blob:
  // (img-src allows data: but not blob:), so createObjectURL breaks attach.
  try {
    const originalDataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(originalDataUrl);
    const dataUrl = getDataUrlForFile(file, img, originalDataUrl);
    const displayImage =
      dataUrl === originalDataUrl ? img : await loadImage(dataUrl);

    return [displayImage, dataUrl];
  } catch (error) {
    console.error("Failed to attach image:", error);
    ideMessenger.post("showToast", [
      "error",
      "Could not read that image. Try a different file.",
    ]);
    return undefined;
  }
}

/** Insert a data-URL image into the TipTap editor (requires allowBase64: true). */
export function insertImageDataUrl(editor: Editor, dataUrl: string): boolean {
  return editor.chain().focus().setImage({ src: dataUrl }).run();
}
