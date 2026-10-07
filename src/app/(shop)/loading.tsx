export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-sunken" />
      <div className="mt-6 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-sunken" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
            </div>
            <div className="size-24 animate-pulse rounded-xl bg-sunken" />
          </div>
        ))}
      </div>
    </main>
  );
}
