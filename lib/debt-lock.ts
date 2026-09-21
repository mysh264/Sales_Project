export async function loadAfterLock<T>(lock: () => Promise<void>, load: () => Promise<T>): Promise<T> {
  await lock();
  return load();
}
