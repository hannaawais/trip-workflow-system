import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Pencil, Plus, Trash2, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card as StatsCard, CardHeader as StatsCardHeader, CardContent as StatsCardContent, CardFooter as StatsCardFooter, CardTitle as StatsCardTitle, CardDescription as StatsCardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Create KM Rate schema
const kmRateSchema = z.object({
  rateValue: z.coerce.number().positive("Rate must be a positive number"),
  effectiveFrom: z.date({
    required_error: "Effective date is required",
  }),
  effectiveTo: z.date().nullable().optional(),
  description: z.string().nullable().optional(),
});

type KmRateFormValues = z.infer<typeof kmRateSchema>;

// KM Rate type
interface KmRate {
  id: number;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  description: string | null;
  createdAt: string;
  createdBy: number;
}

function KmRatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<KmRate | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<number | null>(null);
  const [isRecalculateDialogOpen, setIsRecalculateDialogOpen] = useState(false);

  // Query to fetch KM rates
  const { data: kmRates, isLoading } = useQuery<KmRate[]>({
    queryKey: ['/api/km-rates'],
  });

  // Mutation to create a new KM rate
  const createMutation = useMutation({
    mutationFn: async (data: KmRateFormValues) => {
      const res = await apiRequest("POST", "/api/km-rates", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/km-rates'] });
      toast({
        title: "Success",
        description: "KM rate created successfully",
      });
      setIsAddModalOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to create KM rate: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to update a KM rate
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<KmRateFormValues> }) => {
      const res = await apiRequest("PATCH", `/api/km-rates/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/km-rates'] });
      toast({
        title: "Success",
        description: "KM rate updated successfully",
      });
      setEditingRate(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update KM rate: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a KM rate
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/km-rates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/km-rates'] });
      toast({
        title: "Success",
        description: "KM rate deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setDeletingRateId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete KM rate: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to recalculate all trip costs
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/km-rates/recalculate-trips");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || `Successfully recalculated costs for ${data.updatedCount} trip requests.`,
      });
      setIsRecalculateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to recalculate trip costs: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to recalculate trip costs for a specific rate
  const recalculateRateMutation = useMutation({
    mutationFn: async (rateId: number) => {
      const res = await apiRequest("POST", `/api/km-rates/${rateId}/recalculate-trips`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || `Successfully recalculated costs for ${data.updatedCount} trip requests.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to recalculate trip costs: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Form handling
  const form = useForm<KmRateFormValues>({
    resolver: zodResolver(kmRateSchema),
    defaultValues: {
      rateValue: 0,
      effectiveFrom: new Date(),
      effectiveTo: null,
      description: "",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data });
    } else {
      createMutation.mutate(data);
    }
  });

  const handleEdit = (rate: KmRate) => {
    setEditingRate(rate);
    form.reset({
      rateValue: rate.rateValue,
      effectiveFrom: new Date(rate.effectiveFrom),
      effectiveTo: rate.effectiveTo ? new Date(rate.effectiveTo) : null,
      description: rate.description,
    });
  };

  const handleDelete = (rateId: number) => {
    setDeletingRateId(rateId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingRateId) {
      deleteMutation.mutate(deletingRateId);
    }
  };
  
  const handleRecalculate = () => {
    setIsRecalculateDialogOpen(true);
  };
  
  const confirmRecalculate = () => {
    recalculateMutation.mutate();
  };
  
  // Handler for rate-specific recalculation
  const handleRecalculateRate = (rateId: number) => {
    recalculateRateMutation.mutate(rateId);
  };

  const cancelEdit = () => {
    setEditingRate(null);
    form.reset({
      rateValue: 0,
      effectiveFrom: new Date(),
      effectiveTo: null,
      description: "",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold mb-6">KM Rates Management</h1>
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  // Get current active rate
  const today = new Date();
  const currentRate = kmRates?.find(rate => {
    const effectiveFrom = new Date(rate.effectiveFrom);
    const effectiveTo = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
    return effectiveFrom <= today && (!effectiveTo || effectiveTo >= today);
  });

  const futureRates = kmRates?.filter(rate => {
    const effectiveFrom = new Date(rate.effectiveFrom);
    return effectiveFrom > today;
  }).sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());

  const pastRates = kmRates?.filter(rate => {
    const effectiveFrom = new Date(rate.effectiveFrom);
    const effectiveTo = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
    return effectiveTo && effectiveTo < today;
  }).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  return (
    <Layout>
    <div className="container mx-auto p-4 md:p-6">
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">KM Rates Management</h1>
        <div className="flex gap-2">
          {(["Admin", "Finance"].includes(user?.role) || ["Admin", "Finance"].includes(user?.activeRole)) && (
            <>
              <Button 
                variant="outline" 
                onClick={handleRecalculate}
                disabled={!currentRate || recalculateMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> 
                {recalculateMutation.isPending ? "Recalculating..." : "Recalculate Trip Costs"}
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add New Rate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Current Rate Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard className="col-span-1">
          <StatsCardHeader>
            <StatsCardTitle>Current Rate</StatsCardTitle>
            <StatsCardDescription>Active rate for kilometer calculations</StatsCardDescription>
          </StatsCardHeader>
          <StatsCardContent>
            {currentRate ? (
              <div className="flex flex-col">
                <span className="text-4xl font-bold">{currentRate.rateValue.toFixed(3)} JD</span>
                <span className="text-sm text-muted-foreground">per kilometer</span>
                <div className="mt-2">
                  <span className="text-sm text-muted-foreground">Effective from: </span>
                  <span className="text-sm font-medium">{format(new Date(currentRate.effectiveFrom), 'PPP')}</span>
                </div>
                {currentRate.effectiveTo && (
                  <div>
                    <span className="text-sm text-muted-foreground">Effective to: </span>
                    <span className="text-sm font-medium">{format(new Date(currentRate.effectiveTo), 'PPP')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="text-lg text-muted-foreground">No active rate found</span>
              </div>
            )}
          </StatsCardContent>
        </StatsCard>

        <StatsCard className="col-span-1">
          <StatsCardHeader>
            <StatsCardTitle>Future Rates</StatsCardTitle>
            <StatsCardDescription>Upcoming rate changes</StatsCardDescription>
          </StatsCardHeader>
          <StatsCardContent>
            {futureRates && futureRates.length > 0 ? (
              <div className="space-y-2">
                {futureRates.slice(0, 3).map(rate => (
                  <div key={rate.id} className="flex justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{rate.rateValue.toFixed(3)} JD</div>
                      <div className="text-xs text-muted-foreground">
                        From {format(new Date(rate.effectiveFrom), 'PP')}
                      </div>
                    </div>
                    <Badge variant="outline" className="self-start">Upcoming</Badge>
                  </div>
                ))}
                {futureRates.length > 3 && (
                  <div className="text-sm text-muted-foreground text-center mt-2">
                    +{futureRates.length - 3} more upcoming rates
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="text-sm text-muted-foreground">No future rates scheduled</span>
              </div>
            )}
          </StatsCardContent>
        </StatsCard>

        <StatsCard className="col-span-1">
          <StatsCardHeader>
            <StatsCardTitle>Rate History</StatsCardTitle>
            <StatsCardDescription>Previous KM rates</StatsCardDescription>
          </StatsCardHeader>
          <StatsCardContent>
            {pastRates && pastRates.length > 0 ? (
              <div className="space-y-2">
                {pastRates.slice(0, 3).map(rate => (
                  <div key={rate.id} className="flex justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{rate.rateValue.toFixed(3)} JD</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(rate.effectiveFrom), 'PP')} - {format(new Date(rate.effectiveTo!), 'PP')}
                      </div>
                    </div>
                    <Badge variant="outline" className="self-start">Expired</Badge>
                  </div>
                ))}
                {pastRates.length > 3 && (
                  <div className="text-sm text-muted-foreground text-center mt-2">
                    +{pastRates.length - 3} historical rates
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="text-sm text-muted-foreground">No historical rates</span>
              </div>
            )}
          </StatsCardContent>
        </StatsCard>
      </div>

      {/* KM Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>All KM Rates</CardTitle>
          <CardDescription>Manage all kilometer rates for trip cost calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rate Value (JD)</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Effective To</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                {(["Admin", "Finance"].includes(user?.role) || ["Admin", "Finance"].includes(user?.activeRole)) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kmRates && kmRates.length > 0 ? (
                kmRates.map((rate) => {
                  // Determine rate status
                  const effectiveFrom = new Date(rate.effectiveFrom);
                  const effectiveTo = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
                  let status = "Inactive";
                  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                  
                  if (effectiveFrom <= today && (!effectiveTo || effectiveTo >= today)) {
                    status = "Active";
                    badgeVariant = "default";
                  } else if (effectiveFrom > today) {
                    status = "Upcoming";
                    badgeVariant = "secondary";
                  } else if (effectiveTo && effectiveTo < today) {
                    status = "Expired";
                    badgeVariant = "destructive";
                  }

                  return (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">{rate.rateValue.toFixed(3)}</TableCell>
                      <TableCell>{format(new Date(rate.effectiveFrom), 'PPP')}</TableCell>
                      <TableCell>{rate.effectiveTo ? format(new Date(rate.effectiveTo), 'PPP') : 'Indefinite'}</TableCell>
                      <TableCell>{rate.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant}>{status}</Badge>
                      </TableCell>
                      {(["Admin", "Finance"].includes(user?.role) || ["Admin", "Finance"].includes(user?.activeRole)) && (
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(rate)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRecalculateRate(rate.id)}
                            disabled={recalculateRateMutation.isPending && recalculateRateMutation.variables === rate.id}
                            title="Recalculate trips with this rate"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          {['Admin'].includes(user?.role) || ['Admin'].includes(user?.activeRole) && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(rate.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No rates found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit KM Rate Modal */}
      <Dialog open={isAddModalOpen || editingRate !== null} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false);
          setEditingRate(null);
          form.reset();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Edit KM Rate" : "Add New KM Rate"}</DialogTitle>
            <DialogDescription>
              {editingRate ? "Update the kilometer rate details" : "Enter the details for the new kilometer rate"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="rateValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Value (JD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Amount in JD per kilometer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      The date from which this rate becomes effective
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="effectiveTo"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective To (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>No end date (indefinite)</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 border-b">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start text-left font-normal"
                            onClick={() => form.setValue("effectiveTo", null)}
                          >
                            No end date (indefinite)
                          </Button>
                        </div>
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={date => date <= (form.getValues().effectiveFrom || new Date())}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Leave blank for indefinite validity
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes about this rate..."
                        className="resize-none"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                {editingRate && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingRate ? "Update" : "Add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the KM rate and may affect trip cost calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recalculate Confirmation Dialog */}
      <AlertDialog open={isRecalculateDialogOpen} onOpenChange={setIsRecalculateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculate All Trip Costs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update all trip costs based on the current KM rates. 
              All trips that were calculated using kilometers will be recalculated 
              based on the rate that was active on their trip date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRecalculate}
              disabled={recalculateMutation.isPending}
            >
              {recalculateMutation.isPending ? "Processing..." : "Recalculate All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </Layout>
  );
}

export default KmRatesPage;