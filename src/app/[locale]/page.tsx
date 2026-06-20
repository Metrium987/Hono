import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("common");

  const { data: currencies, error } = await supabase.from("currencies").select();

  return (
    <main>
      <h1>{t("app_name")}</h1>
      <p>ERP & Ecommerce Platform for French Polynesia</p>
      {error ? (
        <p>Supabase connection test: {error.message}</p>
      ) : (
        <div>
          <p>Supabase connection test: Success! Available currencies:</p>
          <ul>
            {currencies?.map((currency) => (
              <li key={currency.id}>{currency.name} ({currency.code})</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
