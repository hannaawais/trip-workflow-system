import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PageSizeSelectorProps {
  currentLimit: number;
  onLimitChange: (limit: number) => void;
  options?: number[];
}

export function PageSizeSelector({ 
  currentLimit = 10, 
  onLimitChange,
  options = [5, 10, 25, 50]
}: PageSizeSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-neutral-500">Show</span>
      <Select
        value={currentLimit.toString()}
        onValueChange={(value) => onLimitChange(Number(value))}
      >
        <SelectTrigger className="w-[80px] h-9">
          <SelectValue placeholder={currentLimit.toString()} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-neutral-500">per page</span>
    </div>
  );
}