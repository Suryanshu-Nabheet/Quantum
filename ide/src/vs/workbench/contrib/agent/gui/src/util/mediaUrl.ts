/** Provider / static asset served from Vite public/ or bundled webview/. */
export function staticAssetUrl(relativePath: string): string | undefined {
  const base = window.vscMediaUrl;
  if (!base) {
    return undefined;
  }
  return `${base.replace(/\/$/, "")}/${relativePath.replace(/^\//, "")}`;
}

export function providerLogoUrl(icon?: string): string | undefined {
  if (!icon) {
    return undefined;
  }
  return staticAssetUrl(`logos/${icon}`);
}
