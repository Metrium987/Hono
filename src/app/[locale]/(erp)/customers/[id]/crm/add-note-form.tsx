"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Send, Loader2 } from "lucide-react";

export function AddNoteForm({ customerId, teamId }: { customerId: string; teamId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  function getTextLength(html: string) {
    if (typeof document === "undefined") return html.length;
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent ?? "").trim().length;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content || getTextLength(content) === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/crm-notes?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, content }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      setContent("");
      toast.success("Note enregistrée");
      router.refresh();
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = !content || getTextLength(content) === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Rédiger une note interne..."
        disabled={loading}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={loading || isEmpty}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
