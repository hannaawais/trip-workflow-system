import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSiteSchema, type Site, type InsertSite } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MapPin, Search } from "lucide-react";
import { z } from "zod";

const siteFormSchema = insertSiteSchema.extend({
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

type SiteFormData = z.infer<typeof siteFormSchema>;

export default function SitesPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const { data: sites = [], isLoading, refetch: refetchSites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    staleTime: 0, // Consider data stale immediately
    gcTime: 0, // React Query v5 syntax (was cacheTime in v4)
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: SiteFormData) => {
      const res = await apiRequest("POST", "/api/sites", data);
      return await res.json();
    },
    onSuccess: async (newSite) => {
      // Add the new site to the cache immediately
      queryClient.setQueryData(["/api/sites"], (old: Site[] = []) => [...old, newSite]);
      
      // Also invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Site created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SiteFormData> }) => {
      console.log("Sending PATCH request with data:", data);
      const res = await apiRequest("PATCH", `/api/sites/${id}`, data);
      return await res.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/sites"] });
      
      // Snapshot the previous value
      const previousSites = queryClient.getQueryData(["/api/sites"]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["/api/sites"], (old: Site[] = []) => 
        old.map(site => 
          site.id === id ? { ...site, ...data } : site
        )
      );
      
      return { previousSites };
    },
    onError: (err, { id, data }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSites) {
        queryClient.setQueryData(["/api/sites"], context.previousSites);
      }
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: async (updatedSite) => {
      // Confirm the optimistic update with server data
      queryClient.setQueryData(["/api/sites"], (old: Site[] = []) => 
        old.map(site => 
          site.id === updatedSite.id ? updatedSite : site
        )
      );
      
      // Invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      setEditingSite(null);
      toast({
        title: "Success",
        description: "Site updated successfully",
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sites/${id}`);
      return await res.json();
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/sites"] });
      
      // Snapshot the previous value
      const previousSites = queryClient.getQueryData(["/api/sites"]);
      
      // Optimistically remove the site
      queryClient.setQueryData(["/api/sites"], (old: Site[] = []) => 
        old.filter(site => site.id !== id)
      );
      
      return { previousSites };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSites) {
        queryClient.setQueryData(["/api/sites"], context.previousSites);
      }
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "Site deleted successfully",
      });
    },
  });

  const createForm = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      abbreviation: "",
      englishName: "",
      city: "",
      region: "",
      gpsLat: undefined,
      gpsLng: undefined,
      siteType: "Other",
      isActive: true,
    },
  });

  const editForm = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
  });

  const handleCreate = (data: SiteFormData) => {
    createSiteMutation.mutate(data);
  };

  const handleUpdate = (data: SiteFormData) => {
    if (editingSite) {
      updateSiteMutation.mutate({ id: editingSite.id, data });
    }
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    editForm.reset({
      abbreviation: site.abbreviation,
      englishName: site.englishName,
      city: site.city || "",
      region: site.region || "",
      gpsLat: site.gpsLat ? Number(site.gpsLat) : undefined,
      gpsLng: site.gpsLng ? Number(site.gpsLng) : undefined,
      siteType: site.siteType,
      isActive: site.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this site?")) {
      deleteSiteMutation.mutate(id);
    }
  };

  const filteredSites = sites.filter(site =>
    site.abbreviation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSiteTypeColor = (type: string) => {
    switch (type) {
      case "Hospital": return "bg-red-100 text-red-800";
      case "Comprehensive clinic": return "bg-blue-100 text-blue-800";
      case "Primary Clinic": return "bg-green-100 text-green-800";
      case "Directory": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const SiteForm = ({ form, onSubmit, isLoading }: { 
    form: any; 
    onSubmit: (data: SiteFormData) => void; 
    isLoading: boolean;
  }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="abbreviation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site Abbreviation *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., AMN-H" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="englishName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>English Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Amman Hospital" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Amman" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Region</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Central Jordan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="siteType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Hospital">Hospital</SelectItem>
                  <SelectItem value="Comprehensive clinic">Comprehensive Clinic</SelectItem>
                  <SelectItem value="Primary Clinic">Primary Clinic</SelectItem>
                  <SelectItem value="Directory">Directory</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gpsLat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GPS Latitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="31.9454"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gpsLng"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GPS Longitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="35.9284"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Active Site</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Allow this site to be selected for trip requests
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingSite(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : editingSite ? "Update Site" : "Create Site"}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading sites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Management</h1>
          <p className="text-muted-foreground">
            Manage locations for trip origin and destination selection
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Site</DialogTitle>
              <DialogDescription>
                Add a new location that can be selected for trip requests.
              </DialogDescription>
            </DialogHeader>
            <SiteForm 
              form={createForm} 
              onSubmit={handleCreate} 
              isLoading={createSiteMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search sites by abbreviation, name, city, or region..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSites.map((site) => (
          <Card key={site.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    {site.abbreviation}
                  </CardTitle>
                  <CardDescription className="font-medium">
                    {site.englishName}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-1">
                  {!site.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  <Badge className={getSiteTypeColor(site.siteType)}>
                    {site.siteType}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(site.city || site.region) && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mr-1" />
                  {[site.city, site.region].filter(Boolean).join(", ")}
                </div>
              )}
              
              {site.gpsLat && site.gpsLng && (
                <div className="text-xs text-muted-foreground">
                  GPS: {Number(site.gpsLat).toFixed(4)}, {Number(site.gpsLng).toFixed(4)}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(site)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(site.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSites.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No sites found matching "{searchTerm}"</p>
        </div>
      )}

      {sites.length === 0 && !searchTerm && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No sites configured yet. Create your first site to get started.</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSite} onOpenChange={() => setEditingSite(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update the site information.
            </DialogDescription>
          </DialogHeader>
          <SiteForm 
            form={editForm} 
            onSubmit={handleUpdate} 
            isLoading={updateSiteMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}