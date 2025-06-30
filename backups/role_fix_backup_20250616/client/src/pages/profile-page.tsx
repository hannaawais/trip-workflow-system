import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Building2, Mail, Phone, MapPin, UserRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    department: user?.department || "",
    companyNumber: user?.companyNumber || "",
    homeAddress: user?.homeAddress || "",
    directManagerName: user?.directManagerName || "",
  });
  
  // Fetch all managers for the dropdown
  const { data: managers = [] } = useQuery({
    queryKey: ["/api/managers"],
    queryFn: async () => {
      const res = await fetch("/api/managers");
      if (!res.ok) throw new Error("Failed to fetch managers");
      return res.json();
    },
    enabled: isEditing, // Only fetch when in edit mode
  });
  
  // Use effect to initialize form data when user is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        email: user.email || "",
        department: user.department || "",
        companyNumber: user.companyNumber || "",
        homeAddress: user.homeAddress || "",
        directManagerName: user.directManagerName || "",
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      fullName?: string;
      email?: string;
      department?: string;
      companyNumber?: string;
      homeAddress?: string;
      directManagerName?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated."
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleManagerChange = (value: string) => {
    setFormData(prev => ({ ...prev, directManagerName: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      fullName: user?.fullName || "",
      email: user?.email || "",
      department: user?.department || "",
      companyNumber: user?.companyNumber || "",
      homeAddress: user?.homeAddress || "",
      directManagerName: user?.directManagerName || "",
    });
    setIsEditing(false);
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-neutral-600">Your Profile</h1>
          <p className="mt-1 text-sm text-neutral-400">
            View and manage your profile information
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left column - User info card */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>User Information</CardTitle>
                  <CardDescription>Your account details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-primary-500 flex items-center justify-center text-white text-3xl">
                      {user.fullName.charAt(0)}
                    </div>
                    <h3 className="mt-4 text-lg font-medium">{user.fullName}</h3>
                    <p className="text-sm text-neutral-500">{user.role}</p>
                    {user.role === 'Manager' && (
                      <p className="text-xs text-neutral-400">Currently in {user.activeRole || 'Manager'} mode</p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-4">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-neutral-400 mr-3" />
                      <span>{user.email || 'No email provided'}</span>
                    </div>
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-neutral-400 mr-3" />
                      <span>{user.department || 'No department assigned'}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-neutral-400 mr-3" />
                      <span>{user.companyNumber || 'No company number provided'}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-5 w-5 text-neutral-400 mr-3" />
                      <span className="text-sm">{user.homeAddress || 'No address provided'}</span>
                    </div>
                    <div className="flex items-center">
                      <UserRound className="h-5 w-5 text-neutral-400 mr-3" />
                      <span className="text-sm">{user.directManagerName || 'No direct manager specified'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column - Edit profile */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Edit Profile</CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          disabled={!isEditing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          disabled={!isEditing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="companyNumber">Company Number</Label>
                        <Input
                          id="companyNumber"
                          name="companyNumber"
                          value={formData.companyNumber}
                          onChange={handleChange}
                          disabled={!isEditing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="homeAddress">Home Address</Label>
                        <Input
                          id="homeAddress"
                          name="homeAddress"
                          value={formData.homeAddress}
                          onChange={handleChange}
                          disabled={!isEditing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="directManagerName">Direct Manager</Label>
                        {isEditing ? (
                          <>
                            <Combobox
                              disabled={!isEditing || updateProfileMutation.isPending}
                              options={managers.map((manager) => ({
                                label: manager.fullName,
                                value: manager.fullName
                              }))}
                              value={formData.directManagerName || ""}
                              onChange={handleManagerChange}
                              placeholder="Select your direct manager"
                              emptyMessage="No managers found"
                            />
                            <p className="text-xs text-gray-500">Select your direct manager from the list</p>
                          </>
                        ) : (
                          <Input
                            id="directManagerName"
                            name="directManagerName"
                            value={formData.directManagerName || ""}
                            disabled={true}
                          />
                        )}
                      </div>

                      <div className="pt-4 flex justify-end space-x-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancel}
                              disabled={updateProfileMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateProfileMutation.isPending}
                            >
                              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setIsEditing(true)}
                          >
                            Edit Profile
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}