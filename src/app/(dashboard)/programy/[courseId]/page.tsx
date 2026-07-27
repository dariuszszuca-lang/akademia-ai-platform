import { redirect } from "next/navigation";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/classroom/${courseId}`);
}
