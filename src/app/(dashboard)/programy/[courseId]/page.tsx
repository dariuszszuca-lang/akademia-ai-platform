import { redirect } from "next/navigation";

export default function ProgramDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  redirect(`/classroom/${params.courseId}`);
}
