import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

interface DateFilterBarProps {
  onMonthChange: (month: number | null) => void;
  onYearChange: (year: number | null) => void;
  className?: string;
}

export default function DateFilterBar({ 
  onMonthChange, 
  onYearChange, 
  className 
}: DateFilterBarProps) {
  // Set defaults to current month and year
  const currentDate = new Date();
  const currentMonthNumber = currentDate.getMonth() + 1; // getMonth() is 0-indexed
  const currentYearNumber = currentDate.getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  
  // Generate array of years from 2020 to current year + 1
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2020 + 2 }, 
    (_, i) => (2020 + i).toString()
  );
  
  // Array of months
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ];

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    onMonthChange(value && value !== 'all' ? parseInt(value) : null);
  };

  const handleYearChange = (value: string) => {
    setSelectedYear(value);
    onYearChange(value && value !== 'all' ? parseInt(value) : null);
  };

  // Initialize filters on component mount - start with no filters
  useEffect(() => {
    // Start with no date filtering applied
    onMonthChange(null);
    onYearChange(null);
  }, []);
  
  const clearFilters = () => {
    setSelectedMonth("all");
    setSelectedYear("all");
    onMonthChange(null);
    onYearChange(null);
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center space-x-1">
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="h-8 w-[110px] text-xs border-neutral-200 bg-white">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedYear} onValueChange={handleYearChange}>
          <SelectTrigger className="h-8 w-[90px] text-xs border-neutral-200 bg-white">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(selectedMonth !== "all" || selectedYear !== "all") && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 px-2 text-xs text-neutral-500 hover:text-neutral-700"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}