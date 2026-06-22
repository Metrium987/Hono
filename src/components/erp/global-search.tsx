"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";

type SearchResults = {
  customers: Array<{ id: string; contact_name: string; company_name: string | null; customer_type: string }>;
  invoices: Array<{ id: string; invoice_number: string; status: string; total_ttc: number; customer: { contact_name: string; company_name: string | null } | null }>;
  products: Array<{ id: string; name: string; price_ht: number; is_published: boolean }>;
};

export function GlobalSearch({ teamId, locale }: { teamId: string; locale: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ customers: [], invoices: [], products: [] });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({ customers: [], invoices: [], products: [] }); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?team_id=${teamId}&q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(`/${locale}${href}`);
  }

  const hasResults = results.customers.length + results.invoices.length + results.products.length > 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground w-44 justify-start font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left text-xs">Rechercher...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] sm:flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Clients, factures, produits..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length >= 2 && !loading && !hasResults && (
            <CommandEmpty>Aucun résultat pour &quot;{query}&quot;</CommandEmpty>
          )}
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">Recherche...</div>
          )}

          {results.customers.length > 0 && (
            <CommandGroup heading="Clients">
              {results.customers.map(c => (
                <CommandItem key={c.id} onSelect={() => go(`/customers/${c.id}`)}>
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{c.company_name ?? c.contact_name}</span>
                  {c.company_name && (
                    <span className="text-muted-foreground text-xs">{c.contact_name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.invoices.length > 0 && (
            <>
              {results.customers.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Factures">
                {results.invoices.map(inv => {
                  const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
                  return (
                    <CommandItem key={inv.id} onSelect={() => go(`/invoices/${inv.id}`)}>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{inv.invoice_number}</span>
                      {cust && (
                        <span className="text-muted-foreground text-xs">
                          {(cust as { company_name?: string | null; contact_name?: string }).company_name ?? (cust as { contact_name?: string }).contact_name}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {results.products.length > 0 && (
            <>
              {(results.customers.length > 0 || results.invoices.length > 0) && <CommandSeparator />}
              <CommandGroup heading="Produits">
                {results.products.map(p => (
                  <CommandItem key={p.id} onSelect={() => go(`/catalog/${p.id}`)}>
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs ml-auto">
                      {Math.round(p.price_ht).toLocaleString("fr-FR")} F HT
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {!query && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Tapez pour rechercher clients, factures ou produits
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
