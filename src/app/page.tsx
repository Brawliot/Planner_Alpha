import { Suspense } from "react";
import { getUser } from "@/lib/session";
import { PageContainer } from "@/components/ui/page-container";
import { PromptForm } from "@/components/prompt-form";

export default function Home() {
  return (
    <PageContainer size="sm" centered>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        <HomeContent />
      </Suspense>
    </PageContainer>
  );
}

async function HomeContent() {
  const user = await getUser();

  return (
    <>
      <h1 className="text-2xl font-semibold">{user ? `Hola, ${user.name}` : "Mando"}</h1>
      <PromptForm />
    </>
  );
}