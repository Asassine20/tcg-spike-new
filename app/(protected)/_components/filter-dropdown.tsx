import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FilterDropdownItem {
  value: string;
  label: string;
}
interface FilterDropdownProps {
  triggerLabel: string;
  triggerLabelDesktop?: string;
  options: FilterDropdownItem[];
  onChange: (value: string) => void;
  value: string;
}

export function FilterDropdown({
  triggerLabel,
  triggerLabelDesktop,
  options,
  onChange,
  value,
}: FilterDropdownProps) {
  const selectedOptionLabel =
    options.find((opt) => opt.value === value)?.label || value;

  const displayLabel = triggerLabelDesktop || triggerLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-1 text-sm">
          <span className="hidden md:inline">{displayLabel}:</span>
          <span className="md:hidden">{triggerLabel}:</span>
          <span className="font-semibold">{selectedOptionLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{displayLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={option.value === value}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange?.(option.value);
              }
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
