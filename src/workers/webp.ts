declare let self: Worker;

self.addEventListener('message', (e) => {
  const { id, buffer } = e.data as { id: unknown; buffer: ArrayBuffer };
  const blob = new Blob([buffer]);
  createImageBitmap(blob)
    .then((decoded) => {
      self.postMessage({ decoded, id }, [decoded]);
    })
    .catch((error: unknown) => {
      self.postMessage({ error, id });
    });
});
