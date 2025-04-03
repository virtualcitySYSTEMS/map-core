self.addEventListener('message', async (e) => {
  const { id, buffer } = e.data;
  const blob = new Blob([buffer]);
  const decoded = await createImageBitmap(blob);
  self.postMessage({ decoded, id }, [decoded]);
});
