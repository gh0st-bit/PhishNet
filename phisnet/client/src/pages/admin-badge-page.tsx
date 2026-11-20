import {normalizeBadgeCriterion} from '@shared/badge-criteria';
import AppLayout from "@/components/layout/app-layout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Edit, Trash2, Award, AlertCircle, Trophy, Star } from "lucide-react";
import { Badge as BadgeUI } from "@/components/ui/badge";

interface Badge {
  archivedAt?:string|null;
  id: number;
  name: string;
  description: string;
  iconUrl: string;
  criteria: any;
  pointValue: number;
  rarity: string;
  isActive: boolean;
  earnedCount: number;
}

export default function AdminBadgePage() {
  const queryClient = useQueryClient();
  const [archived,setArchived]=useState(false);
  const [awardBadge,setAwardBadge]=useState<number|null>(null),[awardEmail,setAwardEmail]=useState(''),[awardReason,setAwardReason]=useState('');
  const restore=useMutation({mutationFn:async(id:number)=>(await apiRequest('POST',`/api/admin/badges/${id}/restore`)).json(),onSuccess:()=>queryClient.invalidateQueries({queryKey:['/api/admin/badges']}),onError:(e:Error)=>setMutationError(e.message)});
  const manual=useMutation({mutationFn:async()=>(await apiRequest('POST',`/api/admin/badges/${awardBadge}/award`,{email:awardEmail,reason:awardReason})).json(),onSuccess:()=>{setAwardBadge(null);setAwardEmail('');setAwardReason('');queryClient.invalidateQueries({queryKey:['/api/admin/badges']});},onError:(e:Error)=>setMutationError(e.message)});
  const [mutationError,setMutationError]=useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    iconUrl: "",
    criteriaType: "quiz_pass",
    criteriaValue: "",
    pointValue: 50,
    rarity: "common",
    isActive: true,
  });

  // Fetch all badges
  const { data, isLoading, error } = useQuery<{ badges: Badge[] }>({
    queryKey: ["/api/admin/badges",archived],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/badges?archived=${archived}&pageSize=100`);
      if (!res.ok) throw new Error("Failed to fetch badges");
      const data=await res.json();return {...data,badges:data.badges.map((badge:any)=>({...badge,pointValue:badge.pointsAwarded,isActive:badge.published}))};
    },
  });

  // Create badge mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const criteria = normalizeBadgeCriterion(buildCriteria(data.criteriaType, data.criteriaValue));
      const res = await apiRequest("POST", "/api/admin/badges", {
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl,
        criteria,
        category: data.criteriaType==='streak_days'?'streak':data.criteriaType==='points_earned'?'milestone':'mastery',
        pointsAwarded: data.pointValue,
        rarity: data.rarity,
        published: data.isActive,
      });
      if (!res.ok) throw new Error("Failed to create badge");
      return res.json();
    },
    onError: (error:Error) => { setMutationError(error.message); },
    onSuccess: () => {
      setMutationError('');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  // Update badge mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const criteria = normalizeBadgeCriterion(buildCriteria(data.criteriaType, data.criteriaValue));
      const res = await apiRequest("PUT", `/api/admin/badges/${id}`, {
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl,
        criteria,
        category: data.criteriaType==='streak_days'?'streak':data.criteriaType==='points_earned'?'milestone':'mastery',
        pointsAwarded: data.pointValue,
        rarity: data.rarity,
        published: data.isActive,
      });
      if (!res.ok) throw new Error("Failed to update badge");
      return res.json();
    },
    onError: (error:Error) => { setMutationError(error.message); },
    onSuccess: () => {
      setMutationError('');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
      setIsDialogOpen(false);
      setEditingBadge(null);
      resetForm();
    },
  });

  // Delete badge mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/badges/${id}`);
      if (!res.ok) throw new Error("Failed to delete badge");
      return res.json();
    },
    onError: (error:Error) => { setMutationError(error.message); },
    onSuccess: () => {
      setMutationError('');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
    },
  });

  const buildCriteria = (type: string, value: string) => {
    switch (type) {
      case "quiz_pass":
        return { type: "quiz_pass", quizId: Number.parseInt(value) };
      case "training_complete":
        return { type: "training_complete", moduleId: Number.parseInt(value) };
      case "training_count":
        return {type:"training_complete",count:Number.parseInt(value)};
      case "perfect_score":
        return {type:"perfect_score",count:Number.parseInt(value)};
      case "points_earned":
        return { type: "points_earned", threshold: Number.parseInt(value) };
      case "streak_days":
        return { type: "streak_days", days: Number.parseInt(value) };
      case "quizzes_passed":
        return { type: "quizzes_passed", count: Number.parseInt(value) };
      default:
        return { type: "custom", description: value };
    }
  };

  const parseCriteria=(input:any)=>{
    try {const c=normalizeBadgeCriterion(input);return {type:c.type==='training_complete'&&!c.resourceId?'training_count':c.type,value:String(c.type==='custom'?c.description:c.resourceId??c.target)};}catch{return {type:'custom',value:''};}
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      iconUrl: "",
      criteriaType: "quiz_pass",
      criteriaValue: "",
      pointValue: 50,
      rarity: "common",
      isActive: true,
    });
  };

  const handleEdit = (badge: Badge) => {
    setEditingBadge(badge);
    const { type, value } = parseCriteria(badge.criteria);
    setFormData({
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl,
      criteriaType: type,
      criteriaValue: value,
      pointValue: badge.pointValue,
      rarity: badge.rarity,
      isActive: badge.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Archive badge "${name}"? Earned achievements will be retained.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBadge) {
      updateMutation.mutate({ id: editingBadge.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      case "rare": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "epic": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "legendary": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case "legendary": return <Trophy className="h-5 w-5" />;
      case "epic": return <Star className="h-5 w-5" />;
      default: return <Award className="h-5 w-5" />;
    }
  };

  return (<AppLayout>{(
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex gap-3"><Button variant={!archived?'default':'outline'} onClick={()=>setArchived(false)}>Active badges</Button><Button variant={archived?'default':'outline'} onClick={()=>setArchived(true)}>Archived badges</Button></div>
      <Dialog open={awardBadge!==null} onOpenChange={open=>{if(!open)setAwardBadge(null);}}><DialogContent><DialogHeader><DialogTitle>Award a manual achievement</DialogTitle><DialogDescription>Choose an active employee in your organization and record the reason.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e=>{e.preventDefault();manual.mutate();}}><label className="block">Employee email<Input type="email" value={awardEmail} onChange={e=>setAwardEmail(e.target.value)} required/></label><label className="block">Reason<Textarea minLength={3} value={awardReason} onChange={e=>setAwardReason(e.target.value)} required/></label>{mutationError&&<p role="alert">{mutationError}</p>}<Button disabled={manual.isPending}>Award badge</Button></form></DialogContent></Dialog>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Badge Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage achievement badges for employees</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingBadge(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Badge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBadge ? "Edit" : "Create"} Badge</DialogTitle>
              <DialogDescription>
                {editingBadge ? "Update badge details and criteria" : "Define a new achievement badge"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mutationError && <p role="alert" className="text-destructive">{mutationError} Your values have been kept. Try again.</p>}
              <div className="space-y-2">
                <Label htmlFor="name">Badge Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Phishing Expert"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What this badge represents..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iconUrl">Icon URL *</Label>
                <Input
                  id="iconUrl"
                  value={formData.iconUrl}
                  onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                  placeholder="https://..."
                  type="url"
                  required
                />
                <p className="text-xs text-muted-foreground">Recommended: SVG or PNG, 128x128px</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rarity">Rarity *</Label>
                  <Select value={formData.rarity} onValueChange={(value) => setFormData({ ...formData, rarity: value })}>
                    <SelectTrigger id="rarity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pointValue">Point Value *</Label>
                  <Input
                    id="pointValue"
                    type="number"
                    min="1"
                    value={formData.pointValue}
                    onChange={(e) => setFormData({ ...formData, pointValue: Number.parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="criteriaType">Earning Criteria *</Label>
                <Select 
                  value={formData.criteriaType} 
                  onValueChange={(value) => setFormData({ ...formData, criteriaType: value, criteriaValue: "" })}
                >
                  <SelectTrigger id="criteriaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz_pass">Pass Specific Quiz</SelectItem>
                    <SelectItem value="training_complete">Complete Training Module</SelectItem>
                    <SelectItem value="points_earned">Earn Total Points</SelectItem>
                    <SelectItem value="streak_days">Activity Streak (Days)</SelectItem>
                    <SelectItem value="quizzes_passed">Pass Multiple Quizzes</SelectItem>
                    <SelectItem value="training_count">Complete Multiple Lessons</SelectItem><SelectItem value="perfect_score">Perfect Quiz Scores</SelectItem><SelectItem value="custom">Manual Award</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="criteriaValue">
                  {formData.criteriaType === "quiz_pass" && "Quiz ID"}
                  {formData.criteriaType === "training_complete" && "Training Module ID"}
                  {formData.criteriaType === "points_earned" && "Points Threshold"}
                  {formData.criteriaType === "streak_days" && "Number of Days"}
                  {formData.criteriaType === "quizzes_passed" && "Number of Quizzes"}
                  {formData.criteriaType === "training_count" && "Number of Lessons"}{formData.criteriaType === "perfect_score" && "Number of Perfect Scores"}{formData.criteriaType === "custom" && "Manual Requirement"}
                  {" *"}
                </Label>
                {formData.criteriaType === "custom" ? (
                  <Textarea
                    id="criteriaValue"
                    value={formData.criteriaValue}
                    onChange={(e) => setFormData({ ...formData, criteriaValue: e.target.value })}
                    placeholder="Describe how this badge is earned..."
                    rows={2}
                  required
                />
              ) : (
                <Input
                  id="criteriaValue"
                  type={formData.criteriaType === "custom" ? "text" : "number"}
                  min="1"
                  value={formData.criteriaValue}
                  onChange={(e) => setFormData({ ...formData, criteriaValue: e.target.value })}
                  placeholder={(() => {
                    if (formData.criteriaType === "quiz_pass") return "Enter quiz ID";
                    if (formData.criteriaType === "training_complete") return "Enter module ID";
                    if (formData.criteriaType === "points_earned") return "e.g., 1000";
                    if (formData.criteriaType === "streak_days") return "e.g., 7";
                    return "e.g., 5";
                  })()}
                  required
                />
              )}
            </div>              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive" className="font-normal cursor-pointer">
                  Badge is active (can be earned)
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingBadge ? "Update" : "Create"} Badge
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {mutationError && <p role="alert" className="text-destructive">{mutationError}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load badges. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data?.badges || []).map((badge) => (
            <Card key={badge.id} data-testid={`badge-admin-${badge.id}`} className="p-5 flex flex-col items-center gap-4 hover:shadow-lg transition-shadow">
              <div className="relative">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${getRarityColor(badge.rarity)}`}>
                  {badge.iconUrl ? (
                    <img src={badge.iconUrl} alt={badge.name} className="w-16 h-16 object-contain" />
                  ) : (
                    getRarityIcon(badge.rarity)
                  )}
                </div>
                {!badge.isActive && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-xs">
                    Inactive
                  </div>
                )}
              </div>

              <div className="text-center space-y-2 flex-1">
                <h3 className="font-semibold text-lg">{badge.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{badge.description}</p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <BadgeUI variant="outline" className={getRarityColor(badge.rarity)}>
                  {badge.rarity}
                </BadgeUI>
                <BadgeUI variant="outline">{badge.pointValue} pts</BadgeUI>
                <BadgeUI variant="secondary">{badge.earnedCount} earned</BadgeUI>
              </div>

              <div className="flex flex-wrap gap-2 w-full pt-2">
                {badge.archivedAt?<Button variant="outline" disabled={restore.isPending} onClick={()=>restore.mutate(badge.id)}>Restore as draft</Button>:<>
                {badge.criteria?.type==='custom'&&badge.isActive&&<Button onClick={()=>{setMutationError('');setAwardBadge(badge.id);}}>Award manually</Button>}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(badge)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(badge.id, badge.name)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" /> Archive
                </Button></>}
              </div>
            </Card>
          ))}

          {!(data?.badges || []).length && (
            <div className="col-span-full text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No badges yet. Create your first achievement badge!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )}</AppLayout>);
}
