import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { insertTripRequestSchema, type InsertTripRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateTripCost } from "@/lib/cost-calculator";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Check, ChevronsUpDown, ArrowRight, Upload, MapPin, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type TripRequestFormData = InsertTripRequest & { tripDate: Date };

interface Site {
  id: number;
  abbreviation: string;
  englishName: string;
  city: string;
  region: string;
  gpsLat: number;
  gpsLng: number;
  siteType: string;
  isActive: boolean;
}

interface Project {
  id: number;
  name: string;
  budget: number;
  departmentId: number;
  managerId: number;
  isActive: boolean;
}

interface KmRate {
  id: number;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface BudgetStatus {
  available: boolean;
  totalBudget: number;
  availableBudget: number;
  message?: string;
  excess?: number;
}

const tripRequestSchema = insertTripRequestSchema;

export default function TripRequestPageRedesigned() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [tripType, setTripType] = useState<"Ticket" | "Planned" | "Urgent">("Ticket");
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();
  const [originOpen, setOriginOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [originalDistance, setOriginalDistance] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [originSearchTerm, setOriginSearchTerm] = useState("");
  const [destinationSearchTerm, setDestinationSearchTerm] = useState("");
  const [homeDeductionMessage, setHomeDeductionMessage] = useState<string | null>(null);
  const [isCalculatingHomeDistance, setIsCalculatingHomeDistance] = useState(false);


  const form = useForm<TripRequestFormData>({
    resolver: zodResolver(tripRequestSchema),
    defaultValues: {
      tripType: "Ticket",
      tripDate: new Date(),
      origin: "",
      destination: "",
      purpose: "",
      ticketNo: "",
      kilometers: 0,
      cost: 0,
      userId: user?.id || 0,
      projectId: null,
    },
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", { all: true }],
    queryFn: () => fetch("/api/projects?all=true").then(res => res.json()),
  });

  const { data: currentKmRate } = useQuery<KmRate>({
    queryKey: ["/api/km-rates/current"],
    queryFn: async () => {
      console.log("Fetching KM rate via useQuery");
      const response = await apiRequest("GET", "/api/km-rates/current");
      const data = await response.json();
      console.log("KM rate useQuery response:", data);
      return data;
    }
  });

  const originSite = sites.find(site => site.abbreviation === form.watch("origin"));
  const destinationSite = sites.find(site => site.abbreviation === form.watch("destination"));

  // Auto-calculate distance and cost when both sites are selected
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if ((name === 'origin' || name === 'destination') && type === 'change') {
        const origin = value.origin;
        const destination = value.destination;
        
        // Clear previous messages when selection changes
        setHomeDeductionMessage(null);
        
        if (origin && destination && origin !== destination) {
          // Check if this is a home trip first
          if (origin === "HOME" || destination === "HOME") {
            calculateHomeTripDistance(origin, destination);
          } else {
            // Regular site-to-site calculation
            const originSite = sites.find(s => s.abbreviation === origin);
            const destinationSite = sites.find(s => s.abbreviation === destination);
            
            if (originSite && destinationSite) {
              console.log(`Calculating distance between ${origin} (${originSite.id}) and ${destination} (${destinationSite.id})`);
              fetchDistance(originSite.id, destinationSite.id);
            }
          }
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [sites]);

  // Watch for manual distance changes (for users with direct cost entry permission)
  useEffect(() => {
    if (user?.directCostEntryPermission) {
      const subscription = form.watch((value, { name, type }) => {
        if (name === 'kilometers' && type === 'change') {
          const kilometers = value.kilometers || 0;
          if (currentKmRate && kilometers > 0) {
            const calculatedCost = kilometers * currentKmRate.rateValue;
            form.setValue('cost', calculatedCost, { shouldValidate: false });
          } else {
            form.setValue('cost', 0, { shouldValidate: false });
          }
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [form, currentKmRate, user?.directCostEntryPermission]);

  // Watch for manual cost changes (for users with direct cost entry permission)
  useEffect(() => {
    if (user?.directCostEntryPermission) {
      const subscription = form.watch((value, { name, type }) => {
        if (name === 'cost' && type === 'change') {
          // When cost is manually entered, set distance to 0
          form.setValue('kilometers', 0, { shouldValidate: false });
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [form, user?.directCostEntryPermission]);

  // Calculate cost when KM rate becomes available and distance is set
  useEffect(() => {
    if (currentKmRate && form.watch("kilometers") > 0 && !user?.directCostEntryPermission) {
      const distance = form.watch("kilometers");
      const cost = distance * currentKmRate.rateValue;
      // Properly round to 2 decimal places to avoid floating point issues
      const roundedCost = Math.round(cost * 100) / 100;
      form.setValue("cost", roundedCost);
    }
  }, [currentKmRate, form, user?.directCostEntryPermission]);

  const calculateHomeTripDistance = async (origin: string, destination: string) => {
    if (origin !== "HOME" && destination !== "HOME") {
      return null;
    }

    setIsCalculatingHomeDistance(true);
    setHomeDeductionMessage(null);

    try {
      const response = await apiRequest("POST", "/api/calculate-home-trip-distance", {
        origin,
        destination
      });

      const homeTripData = await response.json();
      
      if (homeTripData.isHomeTrip) {
        // Set the original distance before deduction
        setOriginalDistance(homeTripData.distance);
        
        // Set the final distance (after deduction)
        form.setValue("kilometers", homeTripData.finalDistance);
        
        // Show deduction message if applicable
        if (homeTripData.homeDeductionKm > 0) {
          setHomeDeductionMessage(
            `Home trip detected: ${homeTripData.homeDeductionKm} km deducted per company policy. ` +
            `(Original: ${homeTripData.distance} km → Final: ${homeTripData.finalDistance} km)`
          );
        } else {
          setHomeDeductionMessage("Home trip detected. No deduction applied.");
        }

        // Calculate cost based on final distance
        // Note: Cost calculation might be delayed if KM rate is still loading
        // We'll trigger it again via useEffect when currentKmRate becomes available

        return homeTripData;
      }
    } catch (error) {
      console.error("Error calculating home trip distance:", error);
      setHomeDeductionMessage("Unable to calculate home trip distance. Please enter manually.");
    } finally {
      setIsCalculatingHomeDistance(false);
    }

    return null;
  };

  const fetchDistance = async (fromSiteId: number, toSiteId: number) => {
    try {
      console.log(`Fetching distance from API: /api/distances/${fromSiteId}/${toSiteId}`);
      const response = await apiRequest("GET", `/api/distances/${fromSiteId}/${toSiteId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Distance API response:", data);
      
      const distance = data.drivingDistance || data.distance || 0;
      console.log(`Setting distance: ${distance} km`);
      console.log(`Current KM rate available:`, currentKmRate);
      
      // Store the originally recommended distance from OpenRoute API
      setOriginalDistance(distance);
      
      // Set the final distance used for calculations (initially same as recommended)
      form.setValue("kilometers", distance);
      
      if (currentKmRate && distance > 0) {
        const cost = Math.round((distance * currentKmRate.rateValue) * 100) / 100;
        console.log(`Calculating cost: ${distance} km × ${currentKmRate.rateValue} JD/km = ${cost} JD`);
        form.setValue("cost", cost);
        
        // Check budget for planned trips
        if (tripType === "Planned" && selectedProject) {
          checkBudget(selectedProject.id, cost);
        }
      } else {
        console.log(`Cost calculation skipped - currentKmRate: ${currentKmRate ? 'exists' : 'null'}, distance: ${distance}, rate value: ${currentKmRate?.rateValue}`);
        
        // Force fetch the rate directly within the distance calculation
        try {
          const response = await apiRequest("GET", "/api/km-rates/current");
          const kmRate = await response.json();
          console.log("Direct KM rate fetch result:", kmRate);
          
          if (kmRate && kmRate.rateValue && distance > 0) {
            const cost = Math.round((distance * kmRate.rateValue) * 100) / 100;
            console.log(`Calculating cost with direct fetch: ${distance} km × ${kmRate.rateValue} JD/km = ${cost} JD`);
            form.setValue("cost", cost);
            
            // Check budget for planned trips
            if (tripType === "Planned" && selectedProject) {
              checkBudget(selectedProject.id, cost);
            }
          }
        } catch (error) {
          console.error("Direct KM rate fetch failed:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching distance:", error);
      console.error("Full error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fromSiteId,
        toSiteId
      });
      // If distance calculation fails, still allow form submission
      setOriginalDistance(null);
      form.setValue("kilometers", 0);
      form.setValue("cost", 0);
    }
  };

  const checkBudget = async (projectId: number, tripCost: number) => {
    try {
      const response = await apiRequest("GET", `/api/projects/${projectId}/budget-check?cost=${tripCost}`);
      const budgetInfo = await response.json();
      setBudgetStatus(budgetInfo);
    } catch (error) {
      console.error("Error checking budget:", error);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: TripRequestFormData) => {
      const tripData = {
        ...data,
        userId: user!.id,
        costCalculatedFromKm: true,
        costMethod: "km" as const,
        kmRateValue: currentKmRate?.rateValue || 0,
        originalDistance: originalDistance
      };

      const response = await apiRequest("POST", "/api/trip-requests", tripData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trip request submitted",
        description: "Your trip request has been submitted for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trip-requests"] });
      form.reset();
    },
    onError: (error: any) => {
      // Extract user-friendly message from server response
      let errorMessage = "Failed to submit trip request. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: "Cannot submit request",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: TripRequestFormData) => {
    console.log("Form submission data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Validate required fields with user-friendly messages
    if (!data.origin || data.origin.trim() === "") {
      toast({
        title: "Origin required",
        description: "Please select where your trip starts from.",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.destination || data.destination.trim() === "") {
      toast({
        title: "Destination required", 
        description: "Please select where you're traveling to.",
        variant: "destructive",
      });
      return;
    }
    
    // Purpose is optional for all trip types
    
    // Ticket number validation for Ticket trips
    if (data.tripType === "Ticket" && (!data.ticketNo || data.ticketNo.trim() === "")) {
      toast({
        title: "Ticket number required",
        description: "Please enter the ticket number for this trip.",
        variant: "destructive",
      });
      return;
    }
    
    if (data.tripType === "Urgent" && (!data.purpose || data.purpose.trim() === "")) {
      toast({
        title: "Purpose required",
        description: "Purpose is required for urgent trips.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if attachment is required for urgent trips
    if (data.tripType === "Urgent" && uploadedFiles.length === 0) {
      toast({
        title: "Attachment required",
        description: "Urgent trips require pre-approval documentation to be uploaded.",
        variant: "destructive",
      });
      return;
    }

    // Check if project is required for planned trips
    if (tripType === "Planned" && (!data.projectId || data.projectId === 0)) {
      toast({
        title: "Project required",
        description: "Project selection is required for planned trips.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Project validation passed, projectId:", data.projectId);

    submitMutation.mutate(data);
  };

  // Backend will handle permission validation for trip creation
  const userRole = user?.activeRole || user?.role;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {false ? (
            <div className="max-w-2xl mx-auto">
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-xl">
                  <CardTitle className="text-2xl font-bold flex items-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold mr-4">
                      !
                    </div>
                    Access Restricted
                  </CardTitle>
                  <CardDescription className="text-white/90">
                    Admin accounts cannot submit trip requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="text-lg text-gray-700">
                      Admin accounts are system accounts for management purposes only.
                    </div>
                    <div className="text-sm text-gray-600">
                      Only physical employees can submit trip requests. If you need to create a trip request, please use a regular employee account.
                    </div>
                    <div className="pt-4">
                      <Button 
                        onClick={() => window.location.href = '/admin'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Go to Admin Dashboard
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
              {/* Main Form Content */}
              <div className="lg:col-span-5">
              <Form {...form}>
                <form id="trip-request-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Step 1: Trip Details */}
                  <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
                      <CardTitle className="text-2xl font-bold flex items-center">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold mr-4">
                          1
                        </div>
                        <div className="flex items-center">
                          <Calendar className="mr-3 h-6 w-6" />
                          Trip Details
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Trip Date */}
                        <FormField
                          control={form.control}
                          name="tripDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-gray-900 flex items-center">
                                <Calendar className="mr-2 h-4 w-4" />
                                Trip Date
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                  onChange={(e) => field.onChange(new Date(e.target.value))}
                                  className="h-12 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Trip Type */}
                        <FormField
                          control={form.control}
                          name="tripType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-gray-900">Trip Type</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    setTripType(value as "Ticket" | "Planned" | "Urgent");
                                  }}
                                  value={field.value}
                                  className="grid grid-cols-3 gap-4 mt-2"
                                >
                                  {[
                                    { value: "Ticket", label: "Ticket", color: "blue" },
                                    { value: "Planned", label: "Planned", color: "green" },
                                    { value: "Urgent", label: "Urgent", color: "red" }
                                  ].map((type) => (
                                    <div key={type.value} className="flex items-center space-x-2 p-3 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                                      <RadioGroupItem 
                                        value={type.value} 
                                        id={type.value.toLowerCase()} 
                                        className={`text-${type.color}-600 border-2`} 
                                      />
                                      <Label 
                                        htmlFor={type.value.toLowerCase()} 
                                        className="text-sm font-medium cursor-pointer"
                                      >
                                        {type.label}
                                      </Label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>



                      {/* Route Selection */}
                      <div className="mt-10">
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                          <MapPin className="mr-3 h-6 w-6 text-blue-600" />
                          Route Selection
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                          {/* Origin */}
                          <FormField
                            control={form.control}
                            name="origin"
                            render={({ field }) => {
                              
                              const filteredSites = sites.filter(site => 
                                site.abbreviation.toLowerCase().includes(originSearchTerm.toLowerCase()) ||
                                site.englishName.toLowerCase().includes(originSearchTerm.toLowerCase())
                              );

                              const displayValue = field.value 
                                ? `${field.value} - ${sites.find(s => s.abbreviation === field.value)?.englishName || ''}`
                                : originSearchTerm;

                              return (
                                <FormItem>
                                  <FormLabel className="text-base font-semibold text-gray-900">From</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Search and select origin..."
                                        className="w-full h-14 px-4 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all bg-white"
                                        value={displayValue}
                                        onChange={(e) => {
                                          setOriginSearchTerm(e.target.value);
                                          if (!e.target.value) {
                                            field.onChange('');
                                          }
                                          setOriginOpen(true);
                                        }}
                                        onFocus={() => setOriginOpen(true)}
                                        onBlur={() => setTimeout(() => setOriginOpen(false), 300)}
                                      />
                                      {originOpen && filteredSites.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                                          {filteredSites.map((site) => (
                                            <div
                                              key={site.id}
                                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                field.onChange(site.abbreviation);
                                                setOriginSearchTerm("");
                                                setOriginOpen(false);
                                              }}
                                            >
                                              <div className="font-medium">{site.abbreviation}</div>
                                              <div className="text-sm text-gray-500">{site.englishName}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />

                          {/* Arrow */}
                          <div className="flex justify-center pb-6">
                            <div className="bg-blue-100 p-3 rounded-full">
                              <ArrowRight className="h-6 w-6 text-blue-600" />
                            </div>
                          </div>

                          {/* Destination */}
                          <FormField
                            control={form.control}
                            name="destination"
                            render={({ field }) => {
                              
                              const filteredSites = sites.filter(site => 
                                site.abbreviation.toLowerCase().includes(destinationSearchTerm.toLowerCase()) ||
                                site.englishName.toLowerCase().includes(destinationSearchTerm.toLowerCase())
                              );

                              const displayValue = field.value 
                                ? `${field.value} - ${sites.find(s => s.abbreviation === field.value)?.englishName || ''}`
                                : destinationSearchTerm;

                              return (
                                <FormItem>
                                  <FormLabel className="text-base font-semibold text-gray-900">To</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Search and select destination..."
                                        className="w-full h-14 px-4 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all bg-white"
                                        value={displayValue}
                                        onChange={(e) => {
                                          setDestinationSearchTerm(e.target.value);
                                          if (!e.target.value) {
                                            field.onChange('');
                                          }
                                          setDestinationOpen(true);
                                        }}
                                        onFocus={() => setDestinationOpen(true)}
                                        onBlur={() => setTimeout(() => setDestinationOpen(false), 300)}
                                      />
                                      {destinationOpen && filteredSites.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                                          {filteredSites.map((site) => (
                                            <div
                                              key={site.id}
                                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                field.onChange(site.abbreviation);
                                                setDestinationSearchTerm("");
                                                setDestinationOpen(false);
                                              }}
                                            >
                                              <div className="font-medium">{site.abbreviation}</div>
                                              <div className="text-sm text-gray-500">{site.englishName}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                      </div>

                      {/* Purpose and Project/Ticket Fields */}
                      <div className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Purpose Field */}
                          <FormField
                            control={form.control}
                            name="purpose"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-base font-semibold text-gray-900 flex items-center">
                                  <FileText className="mr-2 h-4 w-4" />
                                  Purpose {tripType === "Urgent" && <span className="text-red-500 ml-1">*</span>}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={tripType === "Urgent" ? "Purpose is required for urgent trips..." : "Optional purpose description..."}
                                    className="h-12 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Project Selection for Planned and Urgent trips */}
                          {(tripType === "Planned" || tripType === "Urgent") && (
                            <FormField
                              control={form.control}
                              name="projectId"
                              render={({ field }) => {                                
                                const filteredProjects = projects.filter(project => 
                                  project.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                                );

                                const displayValue = field.value 
                                  ? projects.find(p => p.id === field.value)?.name || ''
                                  : projectSearchTerm;

                                return (
                                  <FormItem>
                                    <FormLabel className="text-base font-semibold text-gray-900">
                                      Project {tripType === "Planned" && <span className="text-red-500 ml-1">*</span>}
                                      {tripType === "Urgent" && <span className="text-gray-500 ml-1">(Optional)</span>}
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          placeholder="Search and select project..."
                                          className="w-full h-12 px-4 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 rounded-xl shadow-sm transition-all bg-white"
                                          value={displayValue}
                                          onChange={(e) => {
                                            setProjectSearchTerm(e.target.value);
                                            if (!e.target.value) {
                                              field.onChange(0);
                                              setSelectedProject(undefined);
                                            }
                                            setProjectDropdownOpen(true);
                                          }}
                                          onFocus={() => setProjectDropdownOpen(true)}
                                          onBlur={() => setTimeout(() => setProjectDropdownOpen(false), 300)}
                                        />
                                        {projectDropdownOpen && filteredProjects.length > 0 && (
                                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                                            {filteredProjects.map((project) => (
                                              <div
                                                key={project.id}
                                                className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  field.onChange(project.id);
                                                  setSelectedProject(project);
                                                  setProjectSearchTerm("");
                                                  setProjectDropdownOpen(false);
                                                }}
                                              >
                                                <div className="font-medium">{project.name}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          )}

                          {/* Ticket Number for Ticket trips */}
                          {tripType === "Ticket" && (
                            <FormField
                              control={form.control}
                              name="ticketNo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base font-semibold text-gray-900">Ticket Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter ticket number..."
                                      className="h-12 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all"
                                      value={field.value || ""}
                                      onChange={field.onChange}
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                        {/* Distance Input */}
                        <FormField
                          control={form.control}
                          name="kilometers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold text-gray-900">
                                Distance (km)
                                {originalDistance && (
                                  <span className="text-sm font-normal text-blue-600 ml-2">
                                    (Suggested: {originalDistance} km)
                                  </span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="Enter distance in kilometers..."
                                  className="h-12 text-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl shadow-sm transition-all"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const distance = parseFloat(e.target.value) || 0;
                                    field.onChange(distance);
                                    
                                    // Recalculate cost when distance changes
                                    if (currentKmRate && distance > 0) {
                                      const cost = distance * currentKmRate.rateValue;
                                      form.setValue("cost", cost);
                                      
                                      // Check budget for planned trips
                                      if (tripType === "Planned" && selectedProject) {
                                        checkBudget(selectedProject.id, cost);
                                      }
                                    } else {
                                      form.setValue("cost", 0);
                                    }
                                  }}
                                />
                              </FormControl>
                              {/* Home trip deduction message */}
                              {homeDeductionMessage && (
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-sm text-blue-800 font-medium">
                                    {homeDeductionMessage}
                                  </p>
                                </div>
                              )}
                              {isCalculatingHomeDistance && (
                                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <p className="text-sm text-gray-600">
                                    Calculating home trip distance...
                                  </p>
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Cost Display/Input */}
                        {user?.directCostEntryPermission ? (
                          <FormField
                            control={form.control}
                            name="cost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-base font-semibold text-gray-900">
                                  Cost (JD)
                                  <span className="text-sm font-normal text-green-600 ml-2">
                                    (Direct Entry)
                                  </span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Enter cost in JD..."
                                    className="h-12 text-lg border-2 border-green-200 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 rounded-xl shadow-sm transition-all"
                                    value={field.value ? field.value.toFixed(2) : ""}
                                    onChange={(e) => {
                                      const cost = parseFloat(e.target.value) || 0;
                                      field.onChange(cost);
                                      
                                      // Check budget for planned trips
                                      if (tripType === "Planned" && selectedProject) {
                                        checkBudget(selectedProject.id, cost);
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <div>
                            <Label className="text-base font-semibold text-gray-900">Estimated Cost</Label>
                            <div className="mt-2 p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl">
                              <div className="text-center">
                                <span className="text-2xl font-bold text-green-800">
                                  {form.watch("cost") || 0}
                                </span>
                                <span className="text-lg text-green-600 ml-1">JD</span>
                              </div>
                            </div>
                          </div>
                        )}
                        </div>

                      {/* Budget Status for Planned trips */}
                      {tripType === "Planned" && budgetStatus && (
                        <div className={`mt-8 p-6 rounded-xl border-2 ${budgetStatus.available ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <h4 className={`font-bold text-lg ${budgetStatus.available ? 'text-green-800' : 'text-red-800'}`}>
                            Budget Status
                          </h4>
                          <p className={`text-base mt-2 ${budgetStatus.available ? 'text-green-700' : 'text-red-700'}`}>
                            {budgetStatus.message}
                          </p>
                          {budgetStatus.excess && budgetStatus.excess > 0 && (
                            <p className="text-base mt-1 text-red-700 font-semibold">
                              Budget excess: {budgetStatus.excess} JD
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    </CardContent>
                  </Card>




                </form>
              </Form>
            </div>

            {/* Right Sidebar - Supporting Documentation */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm sticky top-8">
                <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-xl p-3">
                  <CardTitle className="text-sm font-bold flex items-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">
                      3
                    </div>
                    <div className="flex items-center">
                      <Upload className="mr-1 h-4 w-4" />
                      Docs
                    </div>
                  </CardTitle>
                  <CardDescription className="text-orange-100 text-xs">
                    {tripType === "Urgent" ? "Required" : "Optional"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 text-center hover:border-orange-400 transition-all bg-orange-50">
                    <div className="bg-orange-100 p-2 rounded-full inline-block mb-2">
                      <Upload className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="block text-xs font-bold text-gray-900 mb-1">
                          Upload files
                        </span>
                        <span className="block text-xs text-gray-600">
                          PDF, DOC, JPG up to 10MB
                        </span>
                      </label>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="sr-only" 
                        multiple 
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setUploadedFiles(files);
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Show uploaded files */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <h4 className="text-xs font-bold text-gray-900">Uploaded:</h4>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded border border-green-200">
                          <span className="text-xs text-green-800 truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {tripType === "Urgent" && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-700 font-semibold text-center">
                        Documentation required
                      </p>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <h4 className="text-xs font-bold text-gray-900">Accepted:</h4>
                    <div className="space-y-1">
                      {[
                        "PDF docs",
                        "Word files", 
                        "Images",
                        "Max: 10MB"
                      ].map((item, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-gray-50 p-1 rounded">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <Button
                      type="submit"
                      form="trip-request-form"
                      disabled={submitMutation.isPending}
                      onClick={(e) => {
                        console.log("Submit button clicked!", e);
                        console.log("Form is valid:", form.formState.isValid);
                        console.log("Form errors:", form.formState.errors);
                        console.log("Button disabled:", submitMutation.isPending);
                        console.log("Form values:", form.getValues());
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-2 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 text-xs"
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Trip Request"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}