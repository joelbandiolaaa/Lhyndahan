import { redirect } from "next/navigation";

// Account settings moved into /admin/settings.
export default function AccountPage() {
  redirect("/admin/settings");
}
