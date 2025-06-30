import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Site } from "@shared/schema";

interface SiteSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}

export function SiteSelector({ value, onValueChange, placeholder }: SiteSelectorProps) {
  console.log("SiteSelector component rendering...");
  
  const { data: sites = [], isLoading, error } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  console.log("SiteSelector - Sites data:", sites);
  console.log("SiteSelector - Loading:", isLoading);
  console.log("SiteSelector - Error:", error);

  const activeSites = sites.filter(site => site.isActive);
  console.log("SiteSelector - Active sites:", activeSites);

  // Always render the select element
  return (
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => onValueChange(e.target.value)}
        className="h-8 text-sm w-full px-3 py-1 border border-gray-300 rounded-md bg-white focus:border-blue-500 focus:outline-none"
        disabled={isLoading}
      >
        <option value="">{isLoading ? "Loading sites..." : placeholder}</option>
        {activeSites.map((site) => (
          <option key={site.id} value={site.abbreviation}>
            {site.abbreviation} - {site.englishName}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="absolute right-2 top-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute right-2 top-2 text-red-500 text-xs">
          Error
        </div>
      )}
    </div>
  );
}