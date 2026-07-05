import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LoaderDashboardPage() {
  const trucks = await prisma.truck.findMany({
    include: {
      salesman: true,
      sessions: {
        where: { returnedAt: null },
        orderBy: { loadedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { plateNumber: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 rounded-lg bg-ink p-5 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Loader / Unloader</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">Truck Work</h1>
        </header>

        {trucks.length === 0 ? (
          <section className="rounded-lg bg-white p-5 text-xl font-black text-ink shadow-sm">
            No trucks are configured yet.
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truck) => {
              const activeSession = truck.sessions[0];

              return (
                <article key={truck.id} className="rounded-lg bg-white p-5 shadow-sm">
                  <p className="text-sm font-black uppercase text-slate-500">Truck</p>
                  <h2 className="mt-1 text-3xl font-black text-ink">{truck.plateNumber}</h2>
                  <p className="mt-2 text-lg font-bold text-slate-700">
                    {truck.salesman?.fullName ?? "No salesman assigned"}
                  </p>

                  {activeSession ? (
                    <Link
                      href={`/loader/return/${activeSession.id}`}
                      className="mt-5 flex min-h-24 items-center justify-center rounded-lg bg-safety px-4 text-center text-3xl font-black text-white shadow-sm active:scale-[0.99]"
                    >
                      Evening Return
                    </Link>
                  ) : (
                    <Link
                      href={`/loader/load/${truck.id}`}
                      className="mt-5 flex min-h-24 items-center justify-center rounded-lg bg-success px-4 text-center text-3xl font-black text-white shadow-sm active:scale-[0.99]"
                    >
                      Morning Load
                    </Link>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

