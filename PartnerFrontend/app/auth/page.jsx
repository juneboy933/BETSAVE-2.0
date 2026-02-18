import { redirect } from "next/navigation";

export default function LegacyPartnerAuthPage() {
  redirect("/login");
}
