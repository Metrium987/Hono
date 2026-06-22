"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import { GripVertical, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CustomerCard = {
  id: string;
  name: string;
  email: string | null;
  customer_type: string | null;
};

type Stage = "prospect" | "qualifié" | "proposition" | "gagné";

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "prospect",    label: "Prospect",     color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  { id: "qualifié",   label: "Qualifié",      color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "proposition", label: "Proposition",  color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "gagné",      label: "Client/Gagné",  color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

function customerTypeToStage(type: string | null): Stage {
  if (type === "vip") return "gagné";
  if (type === "client") return "proposition";
  if (type === "prospect") return "qualifié";
  return "prospect";
}

function stageToCustomerType(stage: Stage): string | null {
  if (stage === "gagné") return "vip";
  if (stage === "proposition") return "client";
  if (stage === "qualifié") return "prospect";
  return null;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function KanbanCard({ card, isDragging }: { card: CustomerCard; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-md p-3 flex items-start gap-2 group",
        isDragging ? "shadow-2xl ring-2 ring-primary/50 cursor-grabbing" : "cursor-grab hover:border-border/80"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-7 w-7 shrink-0 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
          {getInitials(card.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{card.name}</p>
          {card.email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Mail className="h-2.5 w-2.5 shrink-0" />
              {card.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  cards,
}: {
  stage: typeof STAGES[number];
  cards: CustomerCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-muted/40 rounded-lg p-3 min-h-[200px] min-w-[240px] flex-1 transition-colors",
        isOver && "bg-muted/70 ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", stage.color)}>
          {stage.label}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{cards.length}</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2 flex-1">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50 italic">
            Glissez ici
          </div>
        )}
      </div>
    </div>
  );
}

export function CrmBoardClient({ customers, teamId }: { customers: CustomerCard[]; teamId: string }) {
  const [cards, setCards] = useState<CustomerCard[]>(customers);
  const [activeCard, setActiveCard] = useState<CustomerCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const stages = STAGES.map(s => ({
    ...s,
    cards: cards.filter(c => customerTypeToStage(c.customer_type) === s.id),
  }));

  function onDragStart(event: DragStartEvent) {
    setActiveCard(cards.find(c => c.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as string;
    const targetStage = STAGES.find(s => s.id === over.id);

    if (!targetStage) return;

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const currentStage = customerTypeToStage(card.customer_type);
    if (currentStage === targetStage.id) return;

    const newType = stageToCustomerType(targetStage.id);

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, customer_type: newType } : c));

    try {
      const res = await fetch(`/api/v1/customers/${cardId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_type: newType }),
      });
      if (!res.ok) throw new Error();
      toast.success("Client déplacé");
    } catch {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, customer_type: card.customer_type } : c));
      toast.error("Erreur lors du déplacement");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline CRM</h1>
        <p className="text-sm text-muted-foreground">Glissez les clients entre les étapes du pipeline</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => (
            <KanbanColumn key={stage.id} stage={stage} cards={stage.cards} />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="bg-card border rounded-md p-3 flex items-start gap-2 shadow-2xl ring-2 ring-primary/50 w-64">
              <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-7 w-7 shrink-0 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
                  {getInitials(activeCard.name)}
                </div>
                <p className="text-sm font-medium truncate">{activeCard.name}</p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        {stages.map(s => (
          <span key={s.id} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">{s.cards.length}</Badge>
            {s.label}
          </span>
        ))}
        <span className="ml-auto">Total : {cards.length} clients</span>
      </div>
    </div>
  );
}
