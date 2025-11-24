import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Edit, Trash2, Crown, Star, Sparkles, Award, Eye, EyeOff } from 'lucide-react';
import { badgeFormSchema } from '@/validation/adminSchemas';
import { useToast } from '@/hooks/use-toast';

interface AdminBadge {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  category: string;
  criteria: any; // JSON object
  pointsAwarded: number;
  rarity: string;
  createdAt: string;
  earnedCount?: number;
  published: boolean;
}

interface BadgeListResponse {
  badges: AdminBadge[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const rarityIconMap: Record<string, JSX.Element> = {
  common: <Award className="h-4 w-4" />,
  rare: <Star className="h-4 w-4" />,
  epic: <Sparkles className="h-4 w-4" />,
  legendary: <Crown className="h-4 w-4" />,
};

export default function AdminBadgesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<AdminBadge | null>(null);
  const [badgeFormErrors, setBadgeFormErrors] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    iconUrl: '',
    category: 'milestone',
    rarity: 'common',
    pointsAwarded: 0,
    criteria: '{"type": "training_complete", "count": 1}',
  });

  // Fetch badges
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const { data, isLoading, error } = useQuery<BadgeListResponse>({
    queryKey: ['/api/admin/badges', page, pageSize],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/badges?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch badges');
      return res.json();
    },
    keepPreviousData: true,
  });

  const createBadgeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let parsedCriteria: any;
      try { parsedCriteria = JSON.parse(data.criteria); } catch { throw new Error('Criteria must be valid JSON'); }
      const res = await apiRequest('POST', '/api/admin/badges', {
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl || undefined,
        category: data.category,
        rarity: data.rarity,
        pointsAwarded: data.pointsAwarded,
        criteria: parsedCriteria,
      });
      if (!res.ok) throw new Error('Failed to create badge');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/badges'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateBadgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      let parsedCriteria: any;
      try { parsedCriteria = JSON.parse(data.criteria); } catch { throw new Error('Criteria must be valid JSON'); }
      const res = await apiRequest('PUT', `/api/admin/badges/${id}`, {
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl || undefined,
        rarity: data.rarity,
        criteria: parsedCriteria,
      });
      if (!res.ok) throw new Error('Failed to update badge');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/badges'] });
      setIsDialogOpen(false);
      setEditingBadge(null);
      resetForm();
    },
  });

  const deleteBadgeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/badges/${id}`);
      if (!res.ok) throw new Error('Failed to delete badge');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/badges'] });
    },
  });

  // Publish toggle mutation
  const publishMutation = useMutation({
    mutationFn: async ({ id, published }: { id: number; published: boolean }) => {
      const res = await apiRequest('PATCH', `/api/admin/badges/${id}/publish`, { published });
      if (!res.ok) throw new Error('Failed to update publish status');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/badges'] });
      toast({
        title: variables.published ? '✓ Badge Published' : '✓ Badge Unpublished',
        description: variables.published 
          ? 'Badge is now visible to employees.' 
          : 'Badge is now hidden from employees.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update badge status. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      iconUrl: '',
      category: 'milestone',
      rarity: 'common',
      pointsAwarded: 0,
      criteria: '{"type": "training_complete", "count": 1}',
    });
  };

  const handleEdit = (badge: AdminBadge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description || '',
      iconUrl: badge.iconUrl || '',
      category: badge.category,
      rarity: badge.rarity,
      pointsAwarded: badge.pointsAwarded,
      criteria: JSON.stringify(badge.criteria),
    });
    setIsDialogOpen(true);
  };

  const filtered = (data?.badges || []).filter(b => {
    const matchesFilter = filter === 'all' || b.rarity === filter || b.category === filter;
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Badge Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage achievement badges</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingBadge(null); resetForm(); setBadgeFormErrors([]); }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{editingBadge ? 'Edit Badge' : 'New Badge'}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBadge ? 'Edit Badge' : 'Create Badge'}</DialogTitle>
              <DialogDescription>{editingBadge ? 'Update badge attributes' : 'Define a new achievement badge'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              setBadgeFormErrors([]);
              let parsedCriteria: any;
              try {
                parsedCriteria = JSON.parse(formData.criteria);
              } catch {
                setBadgeFormErrors(['criteria: Invalid JSON format']);
                return;
              }
              const parsed = badgeFormSchema.safeParse({
                name: formData.name,
                description: formData.description || undefined,
                category: formData.category,
                pointsAwarded: formData.pointsAwarded,
                rarity: formData.rarity,
                criteria: parsedCriteria,
              });
              if (!parsed.success) {
                setBadgeFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
                return;
              }
              if (editingBadge) {
                updateBadgeMutation.mutate({ id: editingBadge.id, data: formData });
              } else {
                createBadgeMutation.mutate(formData);
              }
            }} className="space-y-4">
              {badgeFormErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-1">
                    {badgeFormErrors.map(err => <div key={err}>{err}</div>)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milestone">Milestone</SelectItem>
                      <SelectItem value="streak">Streak</SelectItem>
                      <SelectItem value="mastery">Mastery</SelectItem>
                      <SelectItem value="special">Special</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rarity *</Label>
                  <Select value={formData.rarity} onValueChange={(v) => setFormData({ ...formData, rarity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points Awarded</Label>
                  <Input type="number" min="0" value={formData.pointsAwarded} onChange={(e) => setFormData({ ...formData, pointsAwarded: Number.parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Icon URL</Label>
                  <Input value={formData.iconUrl} onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })} placeholder="/badges/my-icon.svg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Criteria JSON *</Label>
                <Textarea value={formData.criteria} onChange={(e) => setFormData({ ...formData, criteria: e.target.value })} rows={4} required />
                <p className="text-xs text-muted-foreground">Example: {`{"type":"streak","days":7}`}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createBadgeMutation.isPending || updateBadgeMutation.isPending}>
                  {(createBadgeMutation.isPending || updateBadgeMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingBadge ? 'Update' : 'Create'} Badge
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input placeholder="Search badges..." value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
        <Select value={filter} onValueChange={(v) => setFilter(v)}>
          <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="common">Common</SelectItem>
            <SelectItem value="rare">Rare</SelectItem>
            <SelectItem value="epic">Epic</SelectItem>
            <SelectItem value="legendary">Legendary</SelectItem>
            <SelectItem value="milestone">Milestone</SelectItem>
            <SelectItem value="streak">Streak</SelectItem>
            <SelectItem value="mastery">Mastery</SelectItem>
            <SelectItem value="special">Special</SelectItem>
          </SelectContent>
        </Select>
        {total > 0 && (
          <div className="flex items-center gap-3 mt-2 md:mt-0">
            <span className="text-xs text-muted-foreground">
              Showing {startIndex}-{endIndex} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 1 || isLoading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >Prev</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next</Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription>Failed to load badges. Please try again.</AlertDescription></Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(badge => (
            <Card key={badge.id} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap gap-2 text-xs mt-auto">
                  <Badge variant="default" className="flex items-center gap-1">
                    {rarityIconMap[badge.rarity]}
                    <span className="capitalize">{badge.rarity}</span>
                  </Badge>
                  <Badge variant="secondary" className="capitalize">{badge.category}</Badge>
                  <Badge variant={badge.published ? "default" : "secondary"}>
                    {badge.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(badge)}><Edit className="h-4 w-4" /></Button>
                  {badge.published ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => publishMutation.mutate({ id: badge.id, published: false })}
                    >
                      <EyeOff className="h-4 w-4" />
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1"
                      onClick={() => publishMutation.mutate({ id: badge.id, published: true })}
                    >
                      <Eye className="h-4 w-4" />
                      Publish
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (confirm(`Delete badge "${badge.name}"? This action cannot be undone.`)) deleteBadgeMutation.mutate(badge.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-base line-clamp-2">{badge.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{badge.description}</p>
              </div>
              {badge.iconUrl && (
                <img src={badge.iconUrl} alt={badge.name} className="h-12 w-12 object-contain" />
              )}
              <div className="flex flex-wrap gap-2 text-xs mt-auto">
                {badge.pointsAwarded > 0 && <Badge variant="outline">{badge.pointsAwarded} pts</Badge>}
                <Badge variant="outline">Earned {badge.earnedCount ?? 0}</Badge>
              </div>
            </Card>
          ))}
          {!filtered.length && (
            <div className="col-span-full py-16 text-center text-muted-foreground">No badges found. Create one to get started.</div>
          )}
        </div>
      )}
    </div>
  );
}
