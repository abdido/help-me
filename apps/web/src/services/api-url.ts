const apiOrigin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/+$/, '') ?? '';

export const apiBaseUrl = `${apiOrigin}/api/v1`;
