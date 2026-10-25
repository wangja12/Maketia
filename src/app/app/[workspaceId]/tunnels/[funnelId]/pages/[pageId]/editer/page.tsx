import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { Editor } from "@/editor/editor";
import { NotFoundError } from "@/server/errors";
import { getPage } from "@/server/pages";
import { listProducts } from "@/server/payments/service";
import { can } from "@/server/workspaces";
import { loadFunnel } from "../../../funnel";
import { loadVersionAction, pageHeadAction, saveContentAction } from "./actions";
import { DESIGN_SKILL_VERSION } from "@/server/design-skill";
import { MANUAL_REVIEW } from "@/server/page-validation";

export const metadata: Metadata = { title: "Éditeur · Maketia" };

export default async function EditorPage({ params }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]/pages/[pageId]/editer">) {
  const { workspaceId, funnelId, pageId } = await params;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const pageHref = `/app/${workspace.id}/tunnels/${funnel.id}/pages/${pageId}`;
  if (!can(workspace.role, "edit")) redirect(pageHref);

  const data = await getPage(getDb(), { userId: user.id }, pageId).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  if (data.page.funnelId !== funnel.id) notFound();
  const products = (await listProducts(getDb(), user.id, workspace.id)).map(({ id, name, price, currency, active }) => ({ id, name, price, currency, active }));

  return (
    <Editor
      initialContent={data.version.content}
      initialVersion={data.page.currentVersion}
      title={`${data.page.name} · variante ${data.page.variantLabel}`}
      backHref={pageHref}
      products={products}
      review={MANUAL_REVIEW}
      skillVersion={DESIGN_SKILL_VERSION}
      server={{
        save: saveContentAction.bind(null, pageId),
        head: pageHeadAction.bind(null, pageId),
        load: loadVersionAction.bind(null, pageId),
      }}
    />
  );
}
