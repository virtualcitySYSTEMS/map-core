export async function requestUrl(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `Failed fetching url ${url} with status: ${response.status}`,
    );
  }
  return response;
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await requestUrl(url, init);
  return response.json() as Promise<T>;
}

export async function requestArrayBuffer(
  url: string,
  init?: RequestInit,
): Promise<ArrayBuffer> {
  const response = await requestUrl(url, init);
  return response.arrayBuffer();
}
