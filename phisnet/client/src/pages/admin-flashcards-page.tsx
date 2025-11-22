import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, Layers, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { flashcardDeckFormSchema, flashcardFormSchema } from "@/validation/adminSchemas";
import { useAuth } from "@/hooks/use-auth";

interface FlashcardDeck {
  id: number;
  title: string;
  description: string | null;
  category: string;
  createdBy: number;
  createdAt: string;
  creatorName?: string;
  cardCount?: number;
}

interface Flashcard {
  id: number;
  deckId: number;
  frontContent: string;
  backContent: string;
  orderIndex: number;
}

interface DeckFormData {
  title: string;
  description: string;
  category: string;
}

interface CardFormData {
  frontContent: string;
  backContent: string;
  orderIndex: number;
}

interface PaginatedDecksResponse {
  decks: FlashcardDeck[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminFlashcardsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const queryClient = useQueryClient();
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [isDeckDialogOpen, setIsDeckDialogOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [deckForm, setDeckForm] = useState<DeckFormData>({ title: "", description: "", category: "general" });
  const [cardForm, setCardForm] = useState<CardFormData>({ frontContent: "", backContent: "", orderIndex: 0 });
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
   const [deckFormErrors, setDeckFormErrors] = useState<string[]>([]);
   const [cardFormErrors, setCardFormErrors] = useState<string[]>([]);

  // Decks query with pagination
  const { data: deckData, isLoading: decksLoading, error: decksError } = useQuery<PaginatedDecksResponse>({
    queryKey: ["/api/admin/flashcard-decks", { search: searchTerm, category: categoryFilter, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      });
      const res = await apiRequest("GET", `/api/admin/flashcard-decks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch decks");
      return res.json();
    },
  });

  // Selected deck with cards
  const { data: deckDetailData, isLoading: deckDetailLoading } = useQuery<{ deck: FlashcardDeck; cards: Flashcard[] } | null>({
    queryKey: selectedDeck ? ["/api/admin/flashcard-decks", selectedDeck.id] : ["deck-none"],
    queryFn: async () => {
      if (!selectedDeck) return null;
      const res = await apiRequest("GET", `/api/admin/flashcard-decks/${selectedDeck.id}`);
      if (!res.ok) throw new Error("Failed to load deck detail");
      return res.json();
    },
    enabled: !!selectedDeck,
  });

  // Mutations
  const createDeckMutation = useMutation({
    mutationFn: async (data: DeckFormData) => {
      const res = await apiRequest("POST", "/api/admin/flashcard-decks", data);
      if (!res.ok) throw new Error("Failed to create deck");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks"] });
      setIsDeckDialogOpen(false);
      resetDeckForm();
    },
  });

  const updateDeckMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DeckFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/flashcard-decks/${id}`, data);
      if (!res.ok) throw new Error("Failed to update deck");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks"] });
      if (selectedDeck) queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks", selectedDeck.id] });
      setIsDeckDialogOpen(false);
      setEditingDeck(null);
      resetDeckForm();
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/flashcard-decks/${id}`);
      if (!res.ok) throw new Error("Failed to delete deck");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks"] });
      if (selectedDeck?.id === editingDeck?.id) setSelectedDeck(null);
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: CardFormData) => {
      if (!selectedDeck) return;
      const res = await apiRequest("POST", `/api/admin/flashcard-decks/${selectedDeck.id}/cards`, data);
      if (!res.ok) throw new Error("Failed to create card");
      return res.json();
    },
    onSuccess: () => {
      if (selectedDeck) queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks", selectedDeck.id] });
      setIsCardDialogOpen(false);
      resetCardForm();
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CardFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/flashcards/${id}`, data);
      if (!res.ok) throw new Error("Failed to update card");
      return res.json();
    },
    onSuccess: () => {
      if (selectedDeck) queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks", selectedDeck.id] });
      setIsCardDialogOpen(false);
      setEditingCard(null);
      resetCardForm();
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/flashcards/${id}`);
      if (!res.ok) throw new Error("Failed to delete card");
      return res.json();
    },
    onSuccess: () => {
      if (selectedDeck) queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks", selectedDeck.id] });
    },
  });

  // Simple reorder (up/down) by swapping orderIndex
  const reorderCard = async (card: Flashcard, direction: "up" | "down") => {
    if (!deckDetailData) return;
    const cards = [...deckDetailData.cards].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = cards.findIndex(c => c.id === card.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cards.length) return;
    const other = cards[targetIdx];
    // swap indexes
    await Promise.all([
      apiRequest("PUT", `/api/admin/flashcards/${card.id}`, { orderIndex: other.orderIndex, frontContent: card.frontContent, backContent: card.backContent }),
      apiRequest("PUT", `/api/admin/flashcards/${other.id}`, { orderIndex: card.orderIndex, frontContent: other.frontContent, backContent: other.backContent }),
    ]);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks", selectedDeck!.id] });
  };

  const resetDeckForm = () => setDeckForm({ title: "", description: "", category: "general" });
  const resetCardForm = () => setCardForm({ frontContent: "", backContent: "", orderIndex: deckDetailData ? deckDetailData.cards.length : 0 });

  const decks = deckData?.decks || [];
  const deckCards = deckDetailData?.cards || [];

  return (
    <AppLayout title="Content: Flashcards">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">Flashcard Decks</h1>
              <p className="text-muted-foreground text-sm">Microlearning decks to reinforce security topics.</p>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={isDeckDialogOpen} onOpenChange={o => { if (!o) { setIsDeckDialogOpen(false); setEditingDeck(null); setDeckFormErrors([]); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetDeckForm(); setEditingDeck(null); setIsDeckDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> New Deck
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingDeck ? "Edit Deck" : "Create Deck"}</DialogTitle>
                  <DialogDescription>Structure flashcards by topic for spaced repetition.</DialogDescription>
                </DialogHeader>
                <form onSubmit={e => {
                  e.preventDefault();
                  setDeckFormErrors([]);
                  const parsed = flashcardDeckFormSchema.safeParse(deckForm);
                  if (!parsed.success) {
                    setDeckFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
                    return;
                  }
                  editingDeck ? updateDeckMutation.mutate({ id: editingDeck.id, data: deckForm }) : createDeckMutation.mutate(deckForm);
                }} className="space-y-4">
                  {deckFormErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription className="space-y-1">
                        {deckFormErrors.map(err => <div key={err}>{err}</div>)}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="deckTitle">Title</Label>
                    <Input id="deckTitle" value={deckForm.title} onChange={e => setDeckForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deckCategory">Category</Label>
                    <Input id="deckCategory" value={deckForm.category} onChange={e => setDeckForm(f => ({ ...f, category: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deckDescription">Description</Label>
                    <Textarea id="deckDescription" rows={3} value={deckForm.description} onChange={e => setDeckForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => { setIsDeckDialogOpen(false); setEditingDeck(null); }}>Cancel</Button>
                    <Button type="submit" disabled={createDeckMutation.isPending || updateDeckMutation.isPending}>
                      {(createDeckMutation.isPending || updateDeckMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editingDeck ? "Save Changes" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="searchDecks" className="text-xs uppercase">Search (client)</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input id="searchDecks" placeholder="Deck title..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div className="min-w-[160px] space-y-1">
              <Label htmlFor="deckCategoryFilter" className="text-xs uppercase">Category</Label>
              <Input id="deckCategoryFilter" placeholder="Filter category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/flashcard-decks"] })}>Refresh</Button>
          </div>

          {decksLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading decks...</div>}
          {decksError && <div className="text-sm text-red-600 dark:text-red-400">Failed to load decks.</div>}

          {!decksLoading && decks.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
            <div className="border rounded-md p-8 flex flex-col items-center justify-center gap-2">
              <span className="text-muted-foreground">No decks found.</span>
              {isAdmin && <Button size="sm" onClick={() => { resetDeckForm(); setEditingDeck(null); setIsDeckDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Deck</Button>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {decks
              .filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(deck => (
                <div key={deck.id} className={`border rounded-lg p-4 flex flex-col gap-3 ${selectedDeck?.id === deck.id ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="cursor-pointer" onClick={() => setSelectedDeck(deck)}>
                      <h3 className="font-semibold line-clamp-2">{deck.title}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">{deck.category}</Badge>
                        {deck.cardCount !== undefined && <Badge variant="outline" className="text-xs">{deck.cardCount} cards</Badge>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingDeck(deck); setDeckForm({ title: deck.title, description: deck.description || "", category: deck.category }); setIsDeckDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete deck "${deck.title}"? This removes all cards.`)) deleteDeckMutation.mutate(deck.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{deck.description || 'No description provided.'}</p>
                  <Button size="sm" variant="outline" onClick={() => setSelectedDeck(deck)}>View Cards</Button>
                </div>
              ))}
          </div>

          {/* Pagination controls */}
          {deckData && deckData.total > deckData.pageSize && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, deckData.total)} of {deckData.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs font-medium">Page {page} / {deckData.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= deckData.totalPages}
                  onClick={() => setPage(p => Math.min(deckData.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {selectedDeck && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Deck: {selectedDeck.title}</h2>
              {isAdmin && <Button size="sm" onClick={() => { resetCardForm(); setEditingCard(null); setIsCardDialogOpen(true); }}>Add Card</Button>}
            </div>
            {deckDetailLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading cards...</div>}
            {!deckDetailLoading && deckCards.length === 0 && <div className="text-sm text-muted-foreground">No cards yet.</div>}
            <div className="space-y-3">
              {deckCards.sort((a,b) => a.orderIndex - b.orderIndex).map(card => (
                <div key={card.id} className="border rounded-md p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{card.frontContent}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.backContent}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" onClick={() => reorderCard(card, 'up')}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => reorderCard(card, 'down')}><ArrowDown className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingCard(card); setCardForm({ frontContent: card.frontContent, backContent: card.backContent, orderIndex: card.orderIndex }); setIsCardDialogOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Delete this card?')) deleteCardMutation.mutate(card.id); }}>Delete</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Dialog open={isCardDialogOpen} onOpenChange={o => { if (!o) { setIsCardDialogOpen(false); setEditingCard(null); setCardFormErrors([]); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCard ? 'Edit Card' : 'Add Card'}</DialogTitle>
              <DialogDescription>{editingCard ? 'Modify flashcard content.' : 'Create a new flashcard for this deck.'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => {
              e.preventDefault();
              setCardFormErrors([]);
              const parsed = flashcardFormSchema.safeParse(cardForm);
              if (!parsed.success) {
                setCardFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
                return;
              }
              editingCard ? updateCardMutation.mutate({ id: editingCard.id, data: cardForm }) : createCardMutation.mutate(cardForm);
            }} className="space-y-4">
              {cardFormErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-1">
                    {cardFormErrors.map(err => <div key={err}>{err}</div>)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="frontContent">Front (Prompt / Question)</Label>
                <Textarea id="frontContent" rows={2} value={cardForm.frontContent} onChange={e => setCardForm(f => ({ ...f, frontContent: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backContent">Back (Answer / Explanation)</Label>
                <Textarea id="backContent" rows={4} value={cardForm.backContent} onChange={e => setCardForm(f => ({ ...f, backContent: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderIndex">Order Index</Label>
                <Input id="orderIndex" type="number" value={cardForm.orderIndex} onChange={e => setCardForm(f => ({ ...f, orderIndex: Number(e.target.value) }))} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => { setIsCardDialogOpen(false); setEditingCard(null); }}>Cancel</Button>
                <Button type="submit" disabled={createCardMutation.isPending || updateCardMutation.isPending}>
                  {(createCardMutation.isPending || updateCardMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingCard ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
