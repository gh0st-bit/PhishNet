import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Search, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface FlashcardDeck {
  id: number;
  title: string;
  description: string | null;
  category: string;
  cardCount: number;
}

interface Flashcard {
  id: number;
  deckId: number;
  frontContent: string;
  backContent: string;
  orderIndex: number;
}

export default function EmployeeFlashcardsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Fetch decks
  const { data: decks, isLoading: decksLoading } = useQuery<FlashcardDeck[]>({
    queryKey: ["/api/employee/flashcard-decks"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
  });

  // Fetch cards for selected deck
  const { data: cards, isLoading: cardsLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/employee/flashcard-decks", selectedDeck?.id, "cards"],
    queryFn: async () => {
      if (!selectedDeck) return [];
      const res = await fetch(`/api/employee/flashcard-decks/${selectedDeck.id}/cards`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch cards');
      return res.json();
    },
    enabled: !!selectedDeck,
    staleTime: 0,
    gcTime: 0,
  });

  // Filter decks
  const filteredDecks = decks?.filter(deck => {
    const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || deck.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  // Get unique categories
  const categories = Array.from(new Set(decks?.map(d => d.category) || []));

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card flip when clicking button
    if (cards && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card flip when clicking button
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card flip when clicking button
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  const handleBackToDecks = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card flip when clicking button
    setSelectedDeck(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  if (decksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  // Deck selection view
  if (!selectedDeck) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Flashcards</h1>
          <p className="text-muted-foreground">
            Practice and reinforce your cybersecurity knowledge
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search decks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Decks Grid */}
        {filteredDecks.length === 0 ? (
          <Card className="p-8 text-center">
            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No flashcard decks available yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDecks.map(deck => (
              <Card key={deck.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedDeck(deck)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Layers className="h-6 w-6 text-primary" />
                    <Badge variant="secondary">{deck.category}</Badge>
                  </div>
                  <CardTitle className="mt-2">{deck.title}</CardTitle>
                  {deck.description && (
                    <CardDescription className="line-clamp-2">{deck.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{deck.cardCount} cards</span>
                    <Button variant="ghost" size="sm">Study →</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Flashcard study view
  const currentCard = cards?.[currentCardIndex];

  // Debug logging
  console.log('=== FLASHCARD DEBUG ===');
  console.log('Selected deck:', selectedDeck);
  console.log('Cards loading:', cardsLoading);
  console.log('Cards array:', cards);
  console.log('Cards length:', cards?.length);
  console.log('Current index:', currentCardIndex);
  console.log('Current card:', currentCard);
  console.log('Front content:', currentCard?.frontContent);
  console.log('Back content:', currentCard?.backContent);
  console.log('=====================');

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button 
            variant="ghost" 
            onClick={handleBackToDecks} 
            className="mb-2 -ml-2 hover:bg-transparent"
          >
            ← Back to Decks
          </Button>
          <h1 className="text-3xl font-bold">{selectedDeck.title}</h1>
          {selectedDeck.description && (
            <p className="text-muted-foreground">{selectedDeck.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {currentCardIndex + 1} / {cards?.length || 0}
        </Badge>
      </div>

      {cardsLoading ? (
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading cards...</p>
          </div>
        </div>
      ) : !cards || cards.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-lg text-muted-foreground">No cards in this deck yet</p>
          <p className="text-sm text-muted-foreground mt-2">Ask your administrator to add some flashcards</p>
        </Card>
      ) : (
        <>
          {/* Flashcard with 3D flip animation */}
          <div className="relative" style={{ perspective: '1000px', minHeight: '450px' }}>
            <div
              className="relative w-full transition-transform duration-500 cursor-pointer"
              style={{ 
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front of card (Question) */}
              <Card 
                className="min-h-[450px] flex flex-col border-2 shadow-lg"
                style={{ 
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <CardHeader className="border-b bg-primary">
                  <div className="flex items-center justify-between text-white">
                    <Badge variant="secondary" className="text-xs">Question</Badge>
                    <span className="text-xs">Click card to reveal answer</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center p-12">
                  <div className="text-center space-y-6 w-full max-w-3xl">
                    <div className="text-3xl font-semibold leading-relaxed whitespace-pre-wrap break-words">
                      {currentCard?.frontContent || 'Loading...'}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
                      <RotateCcw className="h-4 w-4" />
                      <span>Tap to flip</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Back of card (Answer) */}
              <Card 
                className="absolute inset-0 min-h-[450px] flex flex-col border-2 shadow-lg"
                style={{ 
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <CardHeader className="border-b bg-green-600">
                  <div className="flex items-center justify-between text-white">
                    <Badge variant="secondary" className="text-xs">Answer</Badge>
                    <span className="text-xs">Click card to see question</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center p-12">
                  <div className="text-center space-y-6 w-full max-w-3xl">
                    <div className="text-3xl font-semibold leading-relaxed whitespace-pre-wrap break-words text-white">
                      {currentCard?.backContent || 'Loading...'}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-white/80 pt-4">
                      <RotateCcw className="h-4 w-4" />
                      <span>Tap to flip back</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={(e) => handlePrevious(e)}
              disabled={currentCardIndex === 0}
              className="flex-1 max-w-[200px]"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </Button>

            <Button 
              variant="secondary" 
              size="lg"
              onClick={(e) => handleReset(e)}
              className="px-8"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Restart Deck
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={(e) => handleNext(e)}
              disabled={!cards || currentCardIndex === cards.length - 1}
              className="flex-1 max-w-[200px]"
            >
              Next
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {currentCardIndex + 1} of {cards.length} cards completed
            </p>
          </div>

          {/* Completion message */}
          {currentCardIndex === cards.length - 1 && (
            <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/50">
              <CardContent className="p-8 text-center">
                <div className="text-4xl mb-4">🎉</div>
                <p className="text-xl font-semibold mb-2">You've reached the end of this deck!</p>
                <p className="text-muted-foreground mb-4">
                  Great job practicing. Click "Restart Deck" to review again or go back to choose another deck.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={(e) => handleReset(e)} variant="default">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Practice Again
                  </Button>
                  <Button onClick={(e) => handleBackToDecks(e)} variant="outline">
                    Browse More Decks
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
