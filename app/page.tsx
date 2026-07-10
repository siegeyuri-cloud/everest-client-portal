import { redirect } from "next/navigation";

// Root path just forwards to login; the proxy + getPostLoginPath take it
// from there (client -> their portal, Everest team -> /admin).
export default function Home() {
  redirect("/login");
}
