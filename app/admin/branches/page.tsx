import Link from "next/link";
import { redirect } from "next/navigation";
import { saveBranch } from "@/app/actions/branches";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BranchPageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function AdminBranchesPage({ searchParams }: BranchPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN" && currentUser.role !== "GENERAL_MANAGER") {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};
  const [branches, branchToEdit] = await Promise.all([
    prisma.branch.findMany({
      include: {
        company: true,
        users: { select: { id: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    params.editId
      ? prisma.branch.findUnique({
          where: { id: params.editId },
        })
      : Promise.resolve(null),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Admin / Branches</p>
            <h1 className="text-3xl font-black text-slate-950">Branch Configuration</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">Create or update branches and warehouses.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900">
              Back to Admin
            </Link>
            <Link href="/admin/branches" className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white">
              Refresh
            </Link>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">{branchToEdit ? "Edit Branch" : "Add Branch"}</h2>
          </div>
          <form action={saveBranch} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            {branchToEdit ? <input type="hidden" name="branchId" value={branchToEdit.id} /> : null}
            <label className="block">
              <span className="text-sm font-black text-slate-700">Name</span>
              <input
                name="name"
                required
                defaultValue={branchToEdit?.name ?? ""}
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Location</span>
              <input
                name="location"
                defaultValue={branchToEdit?.location ?? ""}
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Code</span>
              <input
                name="code"
                defaultValue={branchToEdit?.code ?? ""}
                placeholder="Optional"
                className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm font-bold outline-none focus:border-slate-950"
              />
            </label>
            <div className="md:col-span-3">
              <button type="submit" className="h-11 rounded bg-slate-950 px-5 text-sm font-black text-white">
                {branchToEdit ? "Save Branch" : "Create Branch"}
              </button>
              {branchToEdit ? (
                <Link href="/admin/branches" className="ml-3 inline-flex h-11 items-center rounded border border-slate-300 bg-white px-5 text-sm font-black text-slate-900">
                  Cancel Edit
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-950">Branch List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Users</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-black text-slate-950">{branch.name}</td>
                    <td className="px-4 py-2 font-bold text-slate-700">{branch.location ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{branch.code}</td>
                    <td className="px-4 py-2 font-bold text-slate-700">{branch.users.length}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/branches?editId=${branch.id}`}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
