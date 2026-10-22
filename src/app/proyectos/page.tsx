import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listOwnProjects } from "@/lib/projects/repository";
import { projectCard } from "@/lib/projects/cards";
import { PageContainer } from "@/components/ui/page-container";
import { ProjectsScreen } from "@/components/projects/projects-screen";

export const metadata: Metadata = { title: "Mis proyectos" };

export default function ProjectsPage() {
  return (
    <PageContainer size="md">
      {/* La sesión es dato de la petición: va dentro de Suspense (cacheComponents). */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        <ProjectsContent />
      </Suspense>
    </PageContainer>
  );
}

async function ProjectsContent() {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await listOwnProjects(user.id);
  return <ProjectsScreen projects={rows.map((row) => projectCard(row, today))} today={today} />;
}