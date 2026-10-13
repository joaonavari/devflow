// A showcase build publishes only the landing page on static hosting, with no API behind it.
export const isShowcase = import.meta.env.VITE_SHOWCASE === 'true';

export const REPOSITORY_URL = 'https://github.com/joaonavari/devflow';

// Files in public/ must follow the base path when the app is not served from the domain root.
export function publicAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}
