export const DEFAULT_COMPANY_DATA = {
  name: "NATIONAL INDUSTRIAL GAS PLANT - OMAN",
  address: "Suhar Industrial City Phase 7, P.O.Box 1195 Zip Code 311",
  vatNumber: "0M1100407450",
};

type CompanyRecord = { id: string };

type CompanyStore = {
  company: {
    findFirst: () => Promise<CompanyRecord | null>;
    create: (args: { data: typeof DEFAULT_COMPANY_DATA }) => Promise<CompanyRecord>;
  };
};

export async function ensureBootstrapCompany(store: CompanyStore): Promise<CompanyRecord> {
  const existing = await store.company.findFirst();
  return existing ?? store.company.create({ data: DEFAULT_COMPANY_DATA });
}
