import { WorkspaceApp } from "@/components/WorkspaceApp";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getWorkspace();
  return <WorkspaceApp initialData={data} />;
}
