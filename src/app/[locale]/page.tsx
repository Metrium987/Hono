import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("common");

  const { data: todos, error } = await supabase.from("todos").select();

  return (
    <main>
      <h1>{t("app_name")}</h1>
      <p>ERP & Ecommerce Platform for French Polynesia</p>
      {error ? (
        <p>Supabase connection test: {error.message}</p>
      ) : (
        <ul>
          {todos?.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
