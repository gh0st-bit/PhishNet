import AppLayout from "@/components/layout/app-layout";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Camera, Upload, X, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  
  const [formState, setFormState] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    position: user?.position || "",
    bio: user?.bio || "",
  });

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiRequest("PUT", "/api/user/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Profile picture upload mutation
  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/user/profile-picture", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to upload profile picture");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    if (!formState.firstName || !formState.lastName) {
      toast({
        title: "Validation Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate(formState);
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPEG, PNG, GIF, or WebP image.",
          variant: "destructive",
        });
        return;
      }
      
      const formData = new FormData();
      formData.append("profilePicture", file);
      uploadProfilePictureMutation.mutate(formData);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle close/back navigation
  const handleClose = () => {
    navigate("/");
  };

  // Generate user initials for avatar fallback
  const userInitials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`;

  return (<AppLayout>{(
    <div className="container max-w-4xl py-6 mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleClose}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Picture Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a profile picture</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Avatar className="h-32 w-32 mb-4">
              <AvatarImage 
                src={user?.profilePicture || undefined} 
                alt={`${user?.firstName} ${user?.lastName}`} 
              />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
              onChange={handleProfilePictureUpload}
            />
            <Button 
              onClick={handleUploadClick}
              variant="outline"
              className="w-full"
              disabled={uploadProfilePictureMutation.isPending}
            >
              {uploadProfilePictureMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Change Picture
            </Button>
          </CardContent>
        </Card>

        {/* Profile Information Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formState.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formState.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">Position/Job Title</Label>
                <Input
                  id="position"
                  name="position"
                  value={formState.position}
                  onChange={handleChange}
                  placeholder="e.g. Security Specialist"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formState.bio}
                  onChange={handleChange}
                  placeholder="Tell us about yourself"
                  rows={4}
                />
              </div>
              
              <div className="pt-2">
                <Label>Email Address</Label>
                <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your email address cannot be changed
                </p>
              </div>
              
              <div className="pt-2">
                <Label>Organization</Label>
                <p className="text-sm text-muted-foreground mt-1">{user?.organizationName}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="ml-auto"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )}</AppLayout>);
}