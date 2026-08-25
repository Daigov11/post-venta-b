// Compartido entre operaciones que recorren muchos clientes contra APIWorking
// con concurrencia limitada (refresh de trabajadores, busqueda de fecha de
// baja) — evita mandar cientos de requests en paralelo de una sola vez.
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  async function next(): Promise<void> {
    const current = index++;
    if (current >= items.length) return;
    await worker(items[current]);
    return next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}
