import { redirect } from "next/navigation";

export default function LegacyAdminAuthPage() {
  redirect("/login");
}
